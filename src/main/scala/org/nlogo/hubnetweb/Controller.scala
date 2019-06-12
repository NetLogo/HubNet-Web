package org.nlogo.hubnetweb

import java.util.UUID

import scala.concurrent.Future
import scala.io.StdIn

import akka.actor.ActorSystem
import akka.http.scaladsl.Http
import akka.http.scaladsl.model.{ ContentTypes, HttpEntity, RemoteAddress }
import akka.http.scaladsl.server.Directives.{ complete, reject }
import akka.http.scaladsl.server.{ RequestContext, RouteResult, ValidationRejection }
import akka.stream.ActorMaterializer

object Controller {

  import akka.http.scaladsl.marshallers.sprayjson.SprayJsonSupport._
  import spray.json.DefaultJsonProtocol._

  case class LaunchReq(modelType: String, model: String, sessionName: String, password: Option[String])

  implicit val launchReqFormat = jsonFormat4(LaunchReq)

  def main(args: Array[String]) {

    implicit val system           = ActorSystem("hnw-system")
    implicit val materializer     = ActorMaterializer()
    implicit val executionContext = system.dispatcher

    val utf8 = ContentTypes.`text/html(UTF-8)`

    val route = {

      import akka.http.scaladsl.server.Directives._

      path("")               { getFromFile("html/index.html") } ~
      path("host")           { getFromFile("html/host.html")  } ~
      path("launch-session") { post { entity(as[LaunchReq])(handleLaunchReq) } } ~
      pathPrefix("js")       { getFromDirectory("js")         } ~
      pathPrefix("assets")   { getFromDirectory("assets")     }

    }

    val bindingFuture = Http().bindAndHandle(route, "localhost", 8080)
    println("""
              |Check me out!  I'm servin'!  I'm SERVIN'!  (at http://localhost:8080/)
              |
              |Press ENTER to stop servin'.""".stripMargin)
    StdIn.readLine()

    bindingFuture.flatMap(_.unbind()).onComplete(_ => system.terminate())

  }

  private def handleLaunchReq(req: LaunchReq): RequestContext => Future[RouteResult] = {

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

        val result =
          SessionManager.createSession(modelSource, req.sessionName, req.password, uuid).
            fold(identity _, identity _): String

        complete(uuid.toString)

    })

  }

}
