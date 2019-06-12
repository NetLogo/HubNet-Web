package org.nlogo.hubnetweb

import java.util.UUID

import scala.collection.Map
import scala.collection.mutable.{ Map => MMap }
import scala.io.Source

object SessionManager {

  private val sessionMap: MMap[UUID, SessionInfo] = MMap()

  private val exampleImages =
    Seq(
      "bizzle"
    , "bryan"
    , "uri"
    )

  def createSession(modelName: String, modelSource: String, name: String, password: Option[String], uuid: UUID): Either[String, String] = {
    val time        = System.currentTimeMillis()
    val anyRoleInfo = RoleInfo("any", 0, None)
    val imageSource = Source.fromFile(s"assets/base64s/${exampleImages(time.toInt % exampleImages.length)}.b64")
    val image       = { val temp = imageSource.mkString; imageSource.close(); temp }
    sessionMap += uuid -> SessionInfo(name, password, Map("any" -> anyRoleInfo), new Oracle(uuid), new Model(modelName, modelSource), image, time)
    Right(uuid.toString)
  }

}

case class Model(name: String, source: String)
case class Oracle(uuid: UUID)
case class RoleInfo(name: String, var numInRole: Int, limit: Option[Int])

case class SessionInfo( name: String, password: Option[String], roleInfo: Map[String, RoleInfo]
                      , oracle: Oracle, model: Model, previewBase64: String
                      , lastUsedTimestamp: Long
                      )
