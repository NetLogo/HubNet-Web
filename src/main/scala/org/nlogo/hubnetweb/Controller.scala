package org.nlogo.hubnetweb.Controller

import scala.io.StdIn

import akka.actor.ActorSystem
import akka.http.scaladsl.Http
import akka.http.scaladsl.model.{ ContentTypes, HttpEntity }
import akka.stream.ActorMaterializer

object Controller {

  def main(args: Array[String]) {

    implicit val system           = ActorSystem("hnw-system")
    implicit val materializer     = ActorMaterializer()
    implicit val executionContext = system.dispatcher

    val utf8 = ContentTypes.`text/html(UTF-8)`

    val route = {

      import akka.http.scaladsl.server.Directives._

      path("")             { getFromFile("html/index.html") } ~
      pathPrefix("js")     { getFromDirectory("js")         } ~
      pathPrefix("assets") { getFromDirectory("assets")     }

    }

    val bindingFuture = Http().bindAndHandle(route, "localhost", 8080)
    println("""
              |Check me out!  I'm servin'!  I'm SERVIN'!  (at http://localhost:8080/)
              |
              |Press ENTER to stop servin'.""".stripMargin)
    StdIn.readLine()

    bindingFuture.flatMap(_.unbind()).onComplete(_ => system.terminate())

  }

}
