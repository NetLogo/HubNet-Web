package org.nlogo.hubnetweb

import java.util.UUID

import scala.collection.Map
import scala.collection.mutable.{ Map => MMap }
import scala.concurrent.duration.FiniteDuration
import scala.io.Source

object SessionManager {

  private val sessionMap: MMap[UUID, SessionInfo] = MMap()

  private val exampleImages =
    Seq(
      "bizzle"
    , "bryan"
    , "uri"
    )

  def createSession( modelName: String, modelSource: String, name: String, password: Option[String]
                   , rtcDesc: String, uuid: UUID, scheduleIn: (FiniteDuration, () => Unit) => Unit
                   ): Either[String, String] = {

    val time        = System.currentTimeMillis()
    val anyRoleInfo = RoleInfo("any", 0, None)
    val imageSource = Source.fromFile(s"assets/base64s/${exampleImages(time.toInt % exampleImages.length)}.b64")
    val image       = { val temp = imageSource.mkString; imageSource.close(); temp }

    sessionMap += uuid -> SessionInfo( uuid, name, password, Map("any" -> anyRoleInfo)
                                     , new ConnectionInfo(rtcDesc, Seq(), None, Seq())
                                     , new Model(modelName, modelSource), image, time
                                     )

    {
      import scala.concurrent.duration.DurationInt
      scheduleIn(25 hours, {
        () =>
          sessionMap -= uuid
          ()
      })
    }

    Right(uuid.toString)

  }

  def getOracleICEDesc(uuid: UUID): Either[String, String] =
    get(uuid)(_.connInfo.oracleICEDescOpt).flatMap(_.toRight("The host has not yet registered their ICE configuration."))

  def getPreview(uuid: UUID): Either[String, String] =
    get(uuid)(_.previewBase64)

  def getRTCDesc(uuid: UUID): Either[String, String] =
    get(uuid)(_.connInfo.oracleOffer)

  def getSessions: Seq[SessionInfo] =
    sessionMap.values.toSeq

  def pullPeerAnswers(uuid: UUID): Either[String, Seq[String]] =
    pull(uuid)(_.connInfo.peerAnswers)((si) => si.copy(connInfo = si.connInfo.copy(peerAnswers = Seq())))

  def pullPeerICEDescs(uuid: UUID): Either[String, Seq[String]] =
    pull(uuid)(_.connInfo.peerICEDescs)((si) => si.copy(connInfo = si.connInfo.copy(peerICEDescs = Seq())))

  def pushPeerAnswer(uuid: UUID, answer: String): Unit =
    push(uuid)(_.connInfo.peerAnswers)(answer)((si, news) => si.copy(connInfo = si.connInfo.copy(peerAnswers = news)))

  def pushPeerICEDesc(uuid: UUID, desc: String): Unit =
    push(uuid)(_.connInfo.peerICEDescs)(desc)((si, news) => si.copy(connInfo = si.connInfo.copy(peerICEDescs = news)))

  def setOracleICEDesc(uuid: UUID, desc: String): Unit = {
    get(uuid)(identity)
      .map((si) => si.copy(connInfo = si.connInfo.copy(oracleICEDescOpt = Option(desc))))
      .foreach((si) => sessionMap.update(uuid, si))
  }

  private def get[T](uuid: UUID)(getter: (SessionInfo) => T): Either[String, T] =
    sessionMap
      .get(uuid)
      .map(getter)
      .toRight("Session not found")

  private def pull[T](uuid: UUID)
                     (getter: (SessionInfo) => T)
                     (setter: (SessionInfo) => SessionInfo): Either[String, T] = {
    val out = get(uuid)(getter)
    get(uuid)(identity)
      .map(setter)
      .foreach((si) => sessionMap.update(uuid, si))
    out
  }

  private def push[T](uuid: UUID)
                     (getter: (SessionInfo) => Seq[T])
                     (item: T)
                     (setter: (SessionInfo, Seq[T]) => SessionInfo): Unit = {
    val olds = get(uuid)(getter).fold(_ => Seq(), identity _)
    get(uuid)(identity)
      .map((si) => setter(si, olds :+ item))
      .foreach((si) => sessionMap.update(uuid, si))
  }

}

case class Model(name: String, source: String)
case class ConnectionInfo( oracleOffer: String, peerAnswers: Seq[String]
                         , oracleICEDescOpt: Option[String], peerICEDescs: Seq[String])
case class RoleInfo(name: String, var numInRole: Int, limit: Option[Int])

case class SessionInfo( uuid: UUID, name: String, password: Option[String], roleInfo: Map[String, RoleInfo]
                      , connInfo: ConnectionInfo, model: Model, previewBase64: String, lastUsedTimestamp: Long
                      )
