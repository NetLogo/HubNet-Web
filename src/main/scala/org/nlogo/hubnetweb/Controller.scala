package org.nlogo.hubnetweb

import java.util.UUID

import scala.concurrent.duration.FiniteDuration
import scala.concurrent.{ ExecutionContext, Future }
import scala.io.StdIn

import akka.actor.ActorSystem
import akka.http.scaladsl.Http
import akka.http.scaladsl.model.{ ContentTypes, HttpEntity, RemoteAddress }
import akka.http.scaladsl.server.Directives.{ complete, extractUpgradeToWebSocket, reject }
import akka.http.scaladsl.server.{ RequestContext, RouteResult, ValidationRejection }
import akka.http.scaladsl.model.ws.TextMessage
import akka.stream.ActorMaterializer
import akka.stream.scaladsl.{ Sink, Source }

object Controller {

  import akka.http.scaladsl.marshallers.sprayjson.SprayJsonSupport._
  import spray.json.DefaultJsonProtocol._

  case class LaunchReq(modelType: String, model: String, modelName: String, sessionName: String, password: Option[String])
  implicit val launchReqFormat = jsonFormat5(LaunchReq)

  case class SessionInfoUpdate(name: String, modelName: String, roleInfo: Seq[(String, Int, Int)], oracleID: String, hasPassword: Boolean)
  implicit val siuFormat = jsonFormat5(SessionInfoUpdate)

  implicit val system       = ActorSystem("hnw-system")
  implicit val materializer = ActorMaterializer()

  def main(args: Array[String]) {

    implicit val executionContext = system.dispatcher

    val utf8 = ContentTypes.`text/html(UTF-8)`

    val route = {

      import akka.http.scaladsl.server.Directives._

      path("")                  { getFromFile("html/index.html") } ~
      path("host")              { getFromFile("html/host.html")  } ~
      path("launch-session")    { post { entity(as[LaunchReq])(handleLaunchReq) } } ~
      path("join")              { getFromFile("html/join.html")  } ~
      path("join-ws")           { extractUpgradeToWebSocket { ws => complete(ws.handleMessagesWithSinkSource(Sink.ignore, joinWSSource)) } } ~
      path("preview" / Segment) { uuid => get { handlePreview(uuid) } } ~
      pathPrefix("js")          { getFromDirectory("js")         } ~
      pathPrefix("assets")      { getFromDirectory("assets")     }

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
          SessionManager.createSession( modelSource, req.modelName, req.sessionName, req.password, uuid, scheduleIn).
            fold(identity _, identity _): String

        complete(uuid.toString)

    })

  }

  private def handlePreview(uuid: String): RequestContext => Future[RouteResult] = {
    complete(SessionManager.getPreview(UUID.fromString(uuid)).fold(identity _, identity _): String)
  }

  private def joinWSSource: Source[TextMessage, _] = {
    import scala.concurrent.duration.DurationInt
    Source
      .tick(0 seconds, 6 seconds, None)
      .map(_  => SessionManager.getSessions.map(sessionToJsonable).map(x => siuFormat.write(x)).toList.toJson)
      .map(xs => TextMessage(xs.toString))
  }

  private def sessionToJsonable(session: SessionInfo): SessionInfoUpdate = {
    val roleInfo = session.roleInfo.values.map(ri => (ri.name, ri.numInRole, ri.limit.getOrElse(0))).toSeq
    SessionInfoUpdate(session.name, session.model.name, roleInfo, session.oracle.uuid.toString, session.password.nonEmpty)
  }

}
