package org.nlogo.hubnetweb

import java.nio.file.Paths
import java.util.UUID

import scala.concurrent.{ Await, ExecutionContext, Future }
import scala.concurrent.duration.FiniteDuration
import scala.io.{ Source => SISource, StdIn }

import akka.actor.ActorSystem
import akka.http.scaladsl.Http
import akka.http.scaladsl.model.{ ContentType, ContentTypes, HttpCharsets, MediaType }
import akka.http.scaladsl.model.MediaType.Compressible
import akka.http.scaladsl.model.StatusCodes.NotFound
import akka.http.scaladsl.model.headers.{ `Access-Control-Allow-Origin` => ACAO }
import akka.http.scaladsl.model.ws.{ BinaryMessage, Message, TextMessage }
import akka.http.scaladsl.server.directives.ContentTypeResolver
import akka.http.scaladsl.server.Directives.{ complete, reject }
import akka.http.scaladsl.server.{ RequestContext, RouteResult, ValidationRejection }
import akka.stream.scaladsl.{ Flow, Merge, Sink, Source }
import akka.util.Timeout

import akka.actor.typed.{ ActorRef, ActorSystem => TASystem }
import akka.actor.typed.scaladsl.AskPattern._
import akka.actor.typed.scaladsl.Behaviors

import spray.json.{ JsArray, JsNumber, JsObject, JsonParser, JsString }

import session.{ SessionInfo, SessionManagerActor }
import session.SessionManagerActor.{ CreateSession, DelistSession, GetPreview
                                   , GetSessions, PullFromHost, PullFromJoiner
                                   , PullJoinerIDs, PulseHost, PushFromHost
                                   , PushFromJoiner, PushNewJoiner, RegisterRoles
                                   , SeshMessageAsk, UpdateNumPeers, UpdatePreview
                                   }

import ChatManagerActor.{ Census, ChatMessageAsk, LogChat, LogTick, PullBuffer
                        , StartLoop }

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

  private case class CensusMessage(`type`: String, num: Int)
  implicit private val cemFormat = jsonFormat2(CensusMessage)

  private case class ChatMessage(`type`: String, sender: Int, message: String, isAuthority: Boolean)
  implicit private val chmFormat = jsonFormat4(ChatMessage)

  implicit private val system           = ActorSystem("hnw-system")
  implicit private val executionContext = system.dispatcher

  private val seshManager = TASystem(SessionManagerActor(), "session-manager-system")
  private val chatManager = TASystem(   ChatManagerActor(),    "chat-manager-system")

  chatManager ! StartLoop {
    (d: FiniteDuration, thunk: () => Unit) =>
      system.scheduler.scheduleOnce(delay = d)(thunk())
      ()
  }

  private val namesToPaths = ModelsLibrary.getFileMappings()

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
             if (filename.endsWith(".mjs")) {
               val mt = MediaType.custom(s"text/javascript", binary = false, Compressible, List("mjs"))
               ContentType(mt, () => HttpCharsets.`UTF-8`)
             }
             else
               ContentTypeResolver.Default(filename)
           }
         }

      path("")                 { getFromFile("html/index.html") } ~
      path("host")             { getFromFile("html/host.html")  } ~
      path("launch-session")   { post { entity(as[LaunchReq])(handleLaunchReq) } } ~
      path("join")             { getFromFile("html/join.html")  } ~
      path("available-models") { get { complete(availableModels) } } ~
      path("library-config")   { get { complete(libraryConfig) } } ~
      path("chat")                             { handleWebSocketMessages(chat) } ~
      path("rtc" / "join" / Segment)           { (hostID)           => get { startJoin(toID(hostID)) } } ~
      path("rtc" / Segment / Segment / "host") { (hostID, joinerID) => handleWebSocketMessages(rtcHost(toID(hostID), toID(joinerID))) } ~
      path("rtc" / Segment / Segment / "join") { (hostID, joinerID) => handleWebSocketMessages(rtcJoiner(toID(hostID), toID(joinerID))) } ~
      path("rtc" / Segment)                    { (hostID)           => handleWebSocketMessages(rtc(toID(hostID))) } ~
      path("hnw" / "session-stream") { handleWebSocketMessages(sessionStream) } ~
      path("hnw" / "my-status" / Segment) { (hostID) => handleWebSocketMessages(sessionStatus(toID(hostID))) } ~
      path("preview" / Segment)      { uuid => get { handlePreview(toID(uuid)) } } ~
      path("depend" / "js" / "pako.esm.mjs") { getFromFile("node_modules/pako/dist/pako.esm.mjs") } ~
      path("depend" / "js" / "marked.esm.js") { getFromFile("node_modules/marked/lib/marked.esm.js") } ~
      path("favicon.ico") { getFromFile("assets/images/favicon.ico") } ~
      pathPrefix("js")               { getFromDirectory("js")         } ~
      pathPrefix("assets")           { getFromDirectory("assets")     } ~
      pathPrefix("models")           { respondWithHeaders(ACAO.*) { getFromDirectory("assets/models") } } ~
      pathPrefix("previews")         { getFromDirectory("assets/previews")     }

    }

    val bindingFuture = Http().bindAndHandle(route, "localhost", 8080)
    println("Now running at http://localhost:8080/.  Press Ctrl+C to stop.".stripMargin)
    StdIn.readLine()

    bindingFuture.flatMap(_.unbind()).onComplete(_ => system.terminate())

  }

  private def handleLaunchReq(req: LaunchReq)(implicit ec: ExecutionContext): RequestContext => Future[RouteResult] = {

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
            CreateSession( modelName, modelSource, json, req.sessionName
                         , req.password, uuid, scheduleIn, replyTo)

        val result = askSeshFor(makeParcel)

        complete(XLaunchResp( uuid.toString, s"from-${req.modelType}"
                            , Some(modelSource), Some(json)))

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
    val trunc    = (name: String) => if (name.length > 20) s"${name.take(20)}..." else name
    val roleInfo = session.roleInfo.values.map(ri => (trunc(ri.name), ri.numInRole, ri.limit.getOrElse(0))).toVector
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
                case JsString("role-config") =>

                  val JsArray(configs) = parsed.fields("roles")

                  val pairs =
                    configs.map {
                      (x) =>
                        val obj             = x.asInstanceOf[JsObject]
                        val JsString( name) = obj.fields("name")
                        val JsNumber(limit) = obj.fields("limit")
                        (name, limit.toInt)
                    }

                  seshManager ! RegisterRoles(hostID, pairs)

                case JsString("members-update") =>
                  val JsArray(xs) = parsed.fields("memberInfo")
                  val nums        = xs.map(_.asInstanceOf[JsNumber])
                  val plainNums   = nums.map { case JsNumber(num) => num.toInt }
                  seshManager ! UpdateNumPeers(hostID, plainNums)

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

  private def chat(): Flow[Message, Message, Any] = {

    import scala.concurrent.duration.DurationDouble
    import scala.concurrent.duration.DurationInt

    var myID: Option[UUID] = None

    val sink =
      Flow[Message].mapConcat {
        case tm: TextMessage =>
          tm.toStrict(100 seconds).map(json => {
            val parsed = JsonParser(json.getStrictText).asInstanceOf[JsObject]
            parsed.fields("type") match {
              case JsString("chat") =>
                val JsString( msg) = parsed.fields("message")
                val JsString(uuid) = parsed.fields("sender")
                val id             = toID(uuid)
                myID               = Option(id)
                chatManager ! LogChat(msg, id)
              case JsString("tick") =>
                val JsString(uuid) = parsed.fields("sender")
                val id             = toID(uuid)
                myID               = Option(id)
                chatManager ! LogTick(id)
              case JsString("keep-alive") =>
              case x =>
                println(s"I don't know what this chatter is: $x")
            }
          })
          Nil
        case binary: BinaryMessage =>
          binary.dataStream.runWith(Sink.ignore)
          Nil
      }

    val msgSource =
      Source
        .tick(0 seconds, 0.01 seconds, None)
        .mapConcat(
          _ => {
            myID.toList.flatMap {
              uuid =>
                askChatFor(PullBuffer(uuid, _)).map {
                  case (id, msg, isPrivileged) =>
                    val cm     = ChatMessage("chat", id, msg, isPrivileged)
                    TextMessage(chmFormat.write(cm).toString)
                }
            }
          }
        )

    val censusSource =
      Source
        .tick(0 seconds, 30 seconds, None)
        .mapConcat(
          _ => {
            val result = askChatFor(Census(_))
            val cm = CensusMessage("census", result)
            List(TextMessage(cemFormat.write(cm).toString))
          }
        )

    val source = Source.combine(msgSource, censusSource)(Merge(_))

    sink.merge(source)

  }

  private def slurpXModelSource(modelName: String): Either[String, (String, String, String)] = {
    import scala.collection.JavaConverters.asScalaIteratorConverter
    val pathStr     = s"./models/$modelName HubNet.nlogo"
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

  private lazy val availableModels = {
    val modelNames = namesToPaths.keys.map(JsString.apply).toVector
    JsArray(modelNames: _*)
  }

  private lazy val libraryConfig = {
    JsObject(ModelsLibrary.getDescriptions().mapValues(JsString.apply))
  }

  private def toID(id: String): UUID = UUID.fromString(id)

  private def askSeshFor[T](makeParcel: ActorRef[T] => SeshMessageAsk[T]): T = {
    import scala.concurrent.duration.DurationInt
    val timeout = Timeout(20 seconds)
    val future = seshManager.ask(replyTo => makeParcel(replyTo))(timeout, seshManager.scheduler)
    Await.result(future, timeout.duration)
  }

  private def askChatFor[T](makeParcel: ActorRef[T] => ChatMessageAsk[T]): T = {
    import scala.concurrent.duration.DurationInt
    val timeout = Timeout(20 seconds)
    val future = chatManager.ask(replyTo => makeParcel(replyTo))(timeout, chatManager.scheduler)
    Await.result(future, timeout.duration)
  }

}
