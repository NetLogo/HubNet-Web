package org.nlogo.hubnetweb

import java.nio.file.{ Files, Path, Paths }
import java.util.UUID

import scala.concurrent.{ Await, ExecutionContext, Future }
import scala.concurrent.duration.FiniteDuration
import scala.io.{ Source => SISource, StdIn }

import akka.actor.ActorSystem
import akka.http.scaladsl.Http
import akka.http.scaladsl.model.{ ContentType, ContentTypes, HttpCharsets, MediaType }
import akka.http.scaladsl.model.MediaType.Compressible
import akka.http.scaladsl.model.StatusCodes.NotFound
import akka.http.scaladsl.model.ws.{ BinaryMessage, Message, TextMessage }
import akka.http.scaladsl.server.directives.ContentTypeResolver
import akka.http.scaladsl.server.Directives.{ complete, reject }
import akka.http.scaladsl.server.{ RequestContext, RouteResult, ValidationRejection }
import akka.stream.scaladsl.{ Flow, Sink, Source }
import akka.util.Timeout

import akka.actor.typed.{ ActorRef, ActorSystem => TASystem }
import akka.actor.typed.scaladsl.AskPattern._
import akka.actor.typed.scaladsl.Behaviors

import spray.json.{ JsArray, JsNumber, JsObject, JsonParser, JsString }

import session.{ SessionInfo, SessionManagerActor }
import session.SessionManagerActor.{ CreateSession, CreateXSession, DelistSession, GetPreview
                                   , GetSessions, PullFromHost, PullFromJoiner, PullJoinerIDs
                                   , PulseHost, PushFromHost, PushFromJoiner, PushNewJoiner
                                   , SeshMessageAsk, UpdateNumPeers, UpdatePreview
                                   }

object Controller {

  import akka.http.scaladsl.marshallers.sprayjson.SprayJsonSupport._
  import spray.json.DefaultJsonProtocol._

  private case class LaunchReq(modelType: String, model: String, config: Option[String], sessionName: String, password: Option[String])
  implicit private val launchReqFormat = jsonFormat5(LaunchReq)

  private case class LaunchResp(id: String, `type`: String, nlogoMaybe: Option[String])
  implicit private val launchRespFormat = jsonFormat3(LaunchResp)

  private case class XLaunchResp(id: String, `type`: String, nlogoMaybe: Option[String], jsonMaybe: Option[String])
  implicit private val xlaunchRespFormat = jsonFormat4(XLaunchResp)

  private case class SessionInfoUpdate(name: String, modelName: String, roleInfo: Vector[(String, Int, Int)], oracleID: String, hasPassword: Boolean)
  implicit private val siuFormat = jsonFormat5(SessionInfoUpdate)

  implicit private val system           = ActorSystem("hnw-system")
  implicit private val executionContext = system.dispatcher

  private val seshManager = TASystem(SessionManagerActor(), "session-manager-system")

  private val namesToPaths = makeModelMappings()

  def main(args: Array[String]) {

    val utf8 = ContentTypes.`text/html(UTF-8)`

    val route = {

      import akka.http.scaladsl.server.Directives._
      import akka.http.scaladsl.marshalling.sse.EventStreamMarshalling.toEventStream

      // So... browsers are super-strict about MIME types of MJS
      // files, so we need to do this, or else no ES6 modules for us!
      // --Jason B. (10/15/21)
      implicit val contentTypeResolver =
        new ContentTypeResolver {
           override def apply(filename: String): ContentType = {
             if (filename.endsWith(".mjs"))
               ContentType(MediaType.custom(s"text/javascript", binary = false, Compressible, List("mjs")), () => HttpCharsets.`UTF-8`)
             else
               ContentTypeResolver.Default(filename)
           }
         }

      path("")                 { getFromFile("html/index.html") } ~
      path("host")             { getFromFile("html/host.html")  } ~
      path("x-launch-session") { post { entity(as[LaunchReq])(handleXLaunchReq) } } ~
      path("join")             { getFromFile("html/join.html")  } ~
      path("available-models") { get { complete(availableModels) } } ~
      path("rtc" / "join" / Segment)           { (hostID)           => get { startJoin(toID(hostID)) } } ~
      path("rtc" / Segment / Segment / "host") { (hostID, joinerID) => handleWebSocketMessages(rtcHost(toID(hostID), toID(joinerID))) } ~
      path("rtc" / Segment / Segment / "join") { (hostID, joinerID) => handleWebSocketMessages(rtcJoiner(toID(hostID), toID(joinerID))) } ~
      path("rtc" / Segment)                    { (hostID)           => handleWebSocketMessages(rtc(toID(hostID))) } ~
      path("hnw" / "session-stream") { handleWebSocketMessages(sessionStream) } ~
      path("hnw" / "my-status" / Segment) { (hostID) => handleWebSocketMessages(sessionStatus(toID(hostID))) } ~
      path("preview" / Segment)      { uuid => get { handlePreview(toID(uuid)) } } ~
      path("depend" / "js" / "pako.esm.mjs") { getFromFile("node_modules/pako/dist/pako.esm.mjs") } ~
      pathPrefix("js")               { getFromDirectory("js")         } ~
      pathPrefix("assets")           { getFromDirectory("assets")     }

    }

    val bindingFuture = Http().bindAndHandle(route, "localhost", 8080)
    println("Now running at http://localhost:8080/.  Press Ctrl+C to stop.".stripMargin)
    StdIn.readLine()

    bindingFuture.flatMap(_.unbind()).onComplete(_ => system.terminate())

  }

  private def handleXLaunchReq(req: LaunchReq)(implicit ec: ExecutionContext): RequestContext => Future[RouteResult] = {

    val modelSourceJsonEither =
      req.modelType match {
        case "library" => slurpXModelSource(req.model)
        case "upload"  => Right((req.model, req.config.getOrElse("no config supplied"), "User Upload"))
        case x         => Left(s"Unknown model type: $x")
      }

    modelSourceJsonEither.fold(
      (msg) => reject(ValidationRejection(msg))
    , {
      case (modelSource, json, modelName) =>

        val uuid = UUID.randomUUID()

        val scheduleIn = {
          (d: FiniteDuration, thunk: () => Unit) =>
            system.scheduler.scheduleOnce(delay = d)(thunk())
            ()
        }

        val makeParcel =
          replyTo =>
            CreateXSession(modelName, modelSource, json, req.sessionName, req.password, uuid, scheduleIn, replyTo)

        val result = askSeshFor(makeParcel)

        complete(XLaunchResp(uuid.toString, s"from-${req.modelType}", Some(modelSource), Some(json)))

    })

  }

  private def handlePreview(uuid: UUID): RequestContext => Future[RouteResult] = {
    askSeshFor(GetPreview(uuid, _)).fold(msg => complete((NotFound, msg)), msg => complete(msg))
  }

  private def sessionStream: Flow[Message, Message, Any] = {

    import scala.concurrent.duration.DurationInt

    var socketNotTerminated = true

    val sink =
      Flow[Message]
        .mapConcat(_ => Nil)
        .watchTermination() {
          (_, dcFuture) =>
            dcFuture.onComplete {
              case _ => socketNotTerminated = false
            }
        }

    val source =
      Source
        .tick(0 seconds, 3 seconds, None)
        .takeWhile(_ => socketNotTerminated)
        .map(_  => askSeshFor(GetSessions(_)).map(sessionToJsonable).map(x => siuFormat.write(x)).toList.toJson)
        .map(xs => TextMessage(xs.toString))

    sink.merge(source)

  }

  private def sessionToJsonable(session: SessionInfo): SessionInfoUpdate = {
    val roleInfo = session.roleInfo.values.map(ri => (ri.name, ri.numInRole, ri.limit.getOrElse(0))).toVector
    SessionInfoUpdate(session.name, session.model.name, roleInfo, session.uuid.toString, session.password.nonEmpty)
  }

  private def startJoin(hostID: UUID): RequestContext => Future[RouteResult] = {
    val response =
      askSeshFor(PushNewJoiner(hostID, _))
        .fold("No more hashes")(uuid => uuid.toString)
    complete(response)
  }

  private def rtcHost(hostID: UUID, joinerID: UUID): Flow[Message, Message, Any] = {

    import scala.concurrent.duration.DurationDouble
    import scala.concurrent.duration.DurationInt

    var socketNotTerminated = true

    val sink =
      Flow[Message].mapConcat {
        case tm: TextMessage =>
          tm.toStrict(100 seconds).map(text => {
            val msg = text.getStrictText
            seshManager ! PushFromHost(hostID, joinerID, msg)
          })
          Nil
        case binary: BinaryMessage =>
          binary.dataStream.runWith(Sink.ignore)
          Nil
      }.watchTermination() {
        (_, dcFuture) =>
          dcFuture.onComplete { // On disconnect...
            case _ => socketNotTerminated = false
          }
      }


    val source =
      Source
        .tick(0 seconds, 0.01 seconds, None)
        .takeWhile(_ => socketNotTerminated)
        .mapConcat(
          _ =>
            askSeshFor(PullFromJoiner(hostID, joinerID, _))
              .fold(_ => Vector(), identity)
              .map(m => TextMessage(m)).toList
        )

    sink.merge(source).watchTermination() {
      (_, dcFuture) =>
        dcFuture.onComplete {
          case _ =>
            seshManager ! PushFromHost(hostID, joinerID, JsObject("type" -> JsString("bye-bye")).toString)
        }
    }

  }

  private def rtcJoiner(hostID: UUID, joinerID: UUID): Flow[Message, Message, Any] = {

    import scala.concurrent.duration.DurationDouble
    import scala.concurrent.duration.DurationInt

    var socketNotTerminated = true

    val sink =
      Flow[Message].mapConcat {
        case tm: TextMessage =>
          tm.toStrict(100 seconds).map(text => seshManager ! PushFromJoiner(hostID, joinerID, text.getStrictText))
          Nil
        case binary: BinaryMessage =>
          binary.dataStream.runWith(Sink.ignore)
          Nil
      }.watchTermination() {
        (_, dcFuture) =>
          dcFuture.onComplete { // On disconnect...
            case _ => socketNotTerminated = false
          }
      }

    val source =
      Source
        .tick(0 seconds, 0.01 seconds, None)
        .takeWhile(_ => socketNotTerminated)
        .mapConcat(
          _ =>
            askSeshFor(PullFromHost(hostID, joinerID, _))
              .fold(_ => Vector(), identity)
              .map(m => TextMessage(m)).toList
        )

    sink.merge(source).watchTermination() {
      (_, dcFuture) =>
        dcFuture.onComplete {
          case _ =>
            seshManager ! PushFromJoiner(hostID, joinerID, JsObject("type" -> JsString("bye-bye")).toString)
        }
    }

  }

  private def rtc(hostID: UUID): Flow[Message, Message, Any] = {

    import scala.concurrent.duration.DurationDouble
    import scala.concurrent.duration.DurationInt

    var socketNotTerminated = true

    val sink =
      Flow[Message]
        .mapConcat(_ => Nil)
        .watchTermination() {
          (_, dcFuture) =>
            dcFuture.onComplete {
              case _ => socketNotTerminated = false
            }
        }

    val source =
      Source
        .tick(0 seconds, 0.01 seconds, None)
        .takeWhile(_ => socketNotTerminated)
        .mapConcat {
          _ =>
            askSeshFor(PullJoinerIDs(hostID, _)).fold(
              _ => Nil
            , {
              ids =>
                val maps  = ids.map(joinerID => Map("joinerID" -> joinerID.toString, "type" -> "hello"))
                val lists = maps.map(map => map.toList.map { case (k, v) => k.toString -> JsString(v) })
                lists.map(list => TextMessage(JsObject(list: _*).toString)).toList
            })
        }

    sink.merge(source)

  }

  private def sessionStatus(hostID: UUID): Flow[Message, Message, Any] = {

    import scala.concurrent.duration.DurationDouble

    Flow[Message]
      .mapConcat {
        case text: TextMessage =>
          text.toStrict(100 seconds).foreach {
            json =>
              val parsed = JsonParser(json.getStrictText).asInstanceOf[JsObject]
              parsed.fields("type") match {
                case JsString("members-update") =>
                  val JsNumber(num) = parsed.fields("numPeers")
                  seshManager ! UpdateNumPeers(hostID, num.toInt)
                case JsString("image-update") =>
                  val JsString(str) = parsed.fields("base64")
                  seshManager ! UpdatePreview(hostID, str)
                case JsString("keep-alive") =>
                  seshManager ! PulseHost(hostID)
                case x =>
                  println(s"I don't know what this is: $x")
              }
          }
          Nil
        case binary: BinaryMessage =>
          binary.dataStream.runWith(Sink.ignore)
          Nil
      }.watchTermination() {
      (_, dcFuture) =>
        dcFuture.onComplete {
          case _ =>
            system.scheduler.scheduleOnce(5 seconds) {
              seshManager ! DelistSession(hostID)
            }
        }
    }


  }

  private def slurpXModelSource(modelName: String): Either[String, (String, String, String)] = {
    import scala.collection.JavaConverters.asScalaIteratorConverter
    val pathStr     = s"./assets/testland/$modelName HubNet.nlogo"
    val modelPath   = Paths.get(pathStr)
    val jsonPath    = Paths.get(s"$pathStr.json")
    val modelSource = { val src = SISource.fromURI(modelPath.toUri); val text = src.mkString; src.close(); text }
    val jsonSource  = { val src = SISource.fromURI( jsonPath.toUri); val text = src.mkString; src.close(); text }
    Right((modelSource, jsonSource, modelName))
  }

  private def slurpModelSource(modelName: String): Either[String, String] =
    namesToPaths
      .get(modelName)
      .map {
        path =>
          val source = SISource.fromURI(path.toUri)
          val nlogo  = source.mkString
          source.close()
          nlogo
      }.toRight(s"Unknown model name: $modelName")

  private def makeModelMappings(): Map[String, Path] = {
    import scala.collection.JavaConverters.asScalaIteratorConverter
    val path  = Paths.get("./models/")
    val paths = Files.walk(path).filter(_.getFileName.toString.endsWith(".nlogo")).iterator.asScala.toVector
    paths.map(x => (x.getFileName.toString.stripSuffix(" HubNet.nlogo"), x)).toMap
  }

  private lazy val availableModels = {
    val modelNames = namesToPaths.keys.map(JsString.apply).toVector
    JsArray(modelNames: _*)
  }

  private def toID(id: String): UUID = UUID.fromString(id)

  private def askSeshFor[T](makeParcel: ActorRef[T] => SeshMessageAsk[T]): T = {
    import scala.concurrent.duration.DurationInt
    val timeout = Timeout(20 seconds)
    val future = seshManager.ask(replyTo => makeParcel(replyTo))(timeout, seshManager.scheduler)
    Await.result(future, timeout.duration)
  }

}
