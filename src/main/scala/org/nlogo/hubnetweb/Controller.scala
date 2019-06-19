package org.nlogo.hubnetweb

import java.util.UUID

import scala.concurrent.duration.FiniteDuration
import scala.concurrent.{ ExecutionContext, Future }
import scala.io.StdIn

import akka.actor.ActorSystem
import akka.http.scaladsl.Http
import akka.http.scaladsl.model.{ ContentTypes, HttpEntity, RemoteAddress }
import akka.http.scaladsl.server.Directives.{ complete, reject }
import akka.http.scaladsl.server.{ RequestContext, RouteResult, ValidationRejection }
import akka.http.scaladsl.model.sse.ServerSentEvent
import akka.stream.ActorMaterializer
import akka.stream.scaladsl.{ Sink, Source }

import spray.json.{ JsArray, JsString }

object Controller {

  import akka.http.scaladsl.marshallers.sprayjson.SprayJsonSupport._
  import spray.json.DefaultJsonProtocol._

  case class LaunchReq(modelType: String, model: String, modelName: String, sessionName: String, password: Option[String], rtcDesc: String)
  implicit val launchReqFormat = jsonFormat6(LaunchReq)

  case class LaunchResp(id: String, `type`: String, nlogoMaybe: Option[String])
  implicit val launchRespFormat = jsonFormat3(LaunchResp)

  case class SessionInfoUpdate(name: String, modelName: String, roleInfo: Seq[(String, Int, Int)], oracleID: String, hasPassword: Boolean)
  implicit val siuFormat = jsonFormat5(SessionInfoUpdate)

  implicit val system       = ActorSystem("hnw-system")
  implicit val materializer = ActorMaterializer()

  def main(args: Array[String]) {

    implicit val executionContext = system.dispatcher

    val utf8 = ContentTypes.`text/html(UTF-8)`

    val route = {

      import akka.http.scaladsl.server.Directives._
      import akka.http.scaladsl.marshalling.sse.EventStreamMarshalling.toEventStream

      path("")                                     { getFromFile("html/index.html") } ~
      path("host")                                 { getFromFile("html/host.html")  } ~
      path("launch-session")                       { post { entity(as[LaunchReq])(handleLaunchReq) } } ~
      path("join")                                 { getFromFile("html/join.html")  } ~
      path("join" / "host-config" / Segment)       { uuid => get { handleJoinRTC(toID(uuid)) } } ~
      path("join" / "host-ice-stream" / Segment)   { uuid => get { complete(getHostICE(toID(uuid))) } ~
                                                             post { entity(as[String])(postHostICE(toID(uuid))) }
                                                   } ~
      path("join" / "joiner-ice-stream" / Segment) { uuid => get { complete(getJoinerICE(toID(uuid))) } ~
                                                             post { entity(as[String])(postJoinerICE(toID(uuid))) }
                                                   } ~
      path("join" / "peer-stream" / Segment)       { uuid => get { complete(getRTCPeers(toID(uuid))) } ~
                                                             post { entity(as[String])(postRTCPeer(toID(uuid))) }
                                                   } ~
      path("join" / "session-stream")              { get { complete(matchMakingEventStream) } } ~
      path("preview" / Segment)                    { uuid => get { handlePreview(toID(uuid)) } } ~
      pathPrefix("js")                             { getFromDirectory("js")         } ~
      pathPrefix("assets")                         { getFromDirectory("assets")     }

    }

    val bindingFuture = Http().bindAndHandle(route, "localhost", 8080)
    println("""
              |Check me out!  I'm servin'!  I'm SERVIN'!  (at http://localhost:8080/)
              |
              |Press ENTER to stop servin'.""".stripMargin)
    StdIn.readLine()

    bindingFuture.flatMap(_.unbind()).onComplete(_ => system.terminate())

  }

  private def handleLaunchReq(req: LaunchReq)(implicit ec: ExecutionContext): RequestContext => Future[RouteResult] = {

    val modelSourceEither =
      req.modelType match {
        case "library" => Right(req.model)
        case "upload"  => Right(req.model)
        case x         => Left(s"Unknown model type: $x")
      }

    modelSourceEither.fold(
      (msg) => reject(ValidationRejection(msg))
    , {
      modelSource =>

        val uuid = UUID.randomUUID

        val scheduleIn = {
          (d: FiniteDuration, thunk: () => Unit) =>
            system.scheduler.scheduleOnce(delay = d)(thunk())
            ()
        }

        val result =
          SessionManager.createSession( modelSource, req.modelName, req.sessionName, req.password
                                      , req.rtcDesc, uuid, scheduleIn
                                      ).merge

        val (modelType, nlogoOption) =
          req.modelType match {
            case "library" => ("from-library", Some(modelSource))
            case "upload"  => ("from-upload" , None)
            case _         => ("from-unknown", None)
          }

        complete(LaunchResp(uuid.toString, modelType, nlogoOption))

    })

  }

  private def handlePreview(uuid: UUID): RequestContext => Future[RouteResult] = {
    complete(SessionManager.getPreview(uuid).merge)
  }

  private def handleJoinRTC(uuid: UUID): RequestContext => Future[RouteResult] = {
    complete(SessionManager.getRTCDesc(uuid).merge)
  }

  private def postRTCPeer(uuid: UUID)(rtcDesc: String): RequestContext => Future[RouteResult] = {
    SessionManager.pushPeerAnswer(uuid, rtcDesc)
    complete("")
  }

  private def getRTCPeers(uuid: UUID): Source[ServerSentEvent, _] = {
    import scala.concurrent.duration.DurationInt
    Source
      .tick(0 seconds, 1 second, None)
      .map {
        _ =>
          val configs = SessionManager.pullPeerAnswers(uuid).fold(_ => Seq(), identity _)
          JsArray(configs.toVector.map(x => JsString(x)))
      }.map(xs => ServerSentEvent(xs.toString))
  }

  private def postHostICE(uuid: UUID)(iceDesc: String): RequestContext => Future[RouteResult] = {
    SessionManager.setOracleICEDesc(uuid, iceDesc)
    complete("")
  }

  private def getHostICE(uuid: UUID): Source[ServerSentEvent, _] = {
    import scala.concurrent.duration.DurationInt
    Source
      .tick(0 seconds, 1 second, None)
      .flatMapConcat {
        _ =>
          val hiceOpt = SessionManager.getOracleICEDesc(uuid).toOption
          hiceOpt.map((hice) => Source.single(JsArray(JsString(hice)))).getOrElse(Source.empty)
      }.map(xs => ServerSentEvent(xs.toString))
  }

  private def postJoinerICE(uuid: UUID)(iceDesc: String): RequestContext => Future[RouteResult] = {
    SessionManager.pushPeerICEDesc(uuid, iceDesc)
    complete("")
  }

  private def getJoinerICE(uuid: UUID): Source[ServerSentEvent, _] = {
    import scala.concurrent.duration.DurationInt
    Source
      .tick(0 seconds, 1 second, None)
      .map {
        _ =>
          val ices = SessionManager.pullPeerICEDescs(uuid).fold(_ => Seq(), identity _)
          JsArray(ices.toVector.map(x => JsString(x)))
      }.map(xs => ServerSentEvent(xs.toString))
  }

  private def matchMakingEventStream: Source[ServerSentEvent, _] = {
    import scala.concurrent.duration.DurationInt
    Source
      .tick(0 seconds, 6 seconds, None)
      .map(_  => SessionManager.getSessions.map(sessionToJsonable).map(x => siuFormat.write(x)).toList.toJson)
      .map(xs => ServerSentEvent(xs.toString))
  }

  private def sessionToJsonable(session: SessionInfo): SessionInfoUpdate = {
    val roleInfo = session.roleInfo.values.map(ri => (ri.name, ri.numInRole, ri.limit.getOrElse(0))).toSeq
    SessionInfoUpdate(session.name, session.model.name, roleInfo, session.uuid.toString, session.password.nonEmpty)
  }

  private def toID(id: String): UUID = UUID.fromString(id)

}
