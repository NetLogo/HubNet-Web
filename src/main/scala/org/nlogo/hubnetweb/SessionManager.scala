package org.nlogo.hubnetweb

import java.util.UUID

import scala.collection.Map
import scala.collection.mutable.{ Map => MMap }
import scala.concurrent.duration.FiniteDuration
import scala.io.Source

object SessionManager {

  private type Scheduler = (FiniteDuration, () => Unit) => Unit

  private val sessionMap: MMap[UUID, SessionInfo] = MMap()

  private val exampleImages =
    Seq(
      "bizzle"
    , "bryan"
    , "uri"
    )

  def createSession( modelName: String, modelSource: String, name: String, password: Option[String]
                   , uuid: UUID, scheduleIn: Scheduler
                   ): Either[String, String] = {

    val time        = System.currentTimeMillis()
    val anyRoleInfo = RoleInfo("any", 0, None)
    val imageSource = Source.fromFile(s"assets/base64s/${exampleImages(Math.abs(time.toInt) % exampleImages.length)}.b64")
    val image       = { val temp = imageSource.mkString; imageSource.close(); temp }

    sessionMap += uuid -> SessionInfo( uuid, name, password, Map("any" -> anyRoleInfo)
                                     , new ConnectionInfo(Seq(), Map(), Map())
                                     , new Model(modelName, modelSource, ""), image, time
                                     )

    {

      import scala.concurrent.duration.DurationInt

      scheduleIn(25 hours, {
        () =>
          sessionMap -= uuid
          ()
      })

      scheduleIn(1 minute, () => checkIn(scheduleIn)(uuid))

    }

    Right(uuid.toString)

  }

  def createXSession( modelName: String, modelSource: String, json: String
                   , name: String, password: Option[String], uuid: UUID, scheduleIn: Scheduler
                   ): Either[String, String] = {

    val time        = System.currentTimeMillis()
    val anyRoleInfo = RoleInfo("any", 0, None)
    val imageSource = Source.fromFile(s"assets/base64s/${exampleImages(Math.abs(time.toInt) % exampleImages.length)}.b64")
    val image       = { val temp = imageSource.mkString; imageSource.close(); temp }

    sessionMap += uuid -> SessionInfo( uuid, name, password, Map("any" -> anyRoleInfo)
                                     , new ConnectionInfo(Seq(), Map(), Map())
                                     , new Model(modelName, modelSource, json), image, time
                                     )

    {

      import scala.concurrent.duration.DurationInt

      scheduleIn(25 hours, {
        () =>
          sessionMap -= uuid
          ()
      })

      scheduleIn(1 minute, () => checkIn(scheduleIn)(uuid))

    }

    Right(uuid.toString)

  }

  private def checkIn(scheduleIn: Scheduler)(hostID: UUID): Unit = {

    import scala.concurrent.duration.DurationInt

    val timestamp = sessionMap(hostID).lastCheckInTimestamp

    if (timestamp > (System.currentTimeMillis() - (1 * 60 * 1000)))
      scheduleIn(1 minute, () => checkIn(scheduleIn)(hostID))
    else
      sessionMap -= hostID

    ()

  }

  private def pulseHost(hostID: UUID): Unit =
    sessionMap(hostID) = sessionMap(hostID).copy(lastCheckInTimestamp = System.currentTimeMillis())

  def updateNumPeers(hostID: UUID, numPeers: Int): Unit = {
    pulseHost(hostID)
    sessionMap(hostID).roleInfo("any").numInRole = numPeers
  }

  def updatePreview(hostID: UUID, base64: String): Unit = {
    pulseHost(hostID)
    sessionMap(hostID) = sessionMap(hostID).copy(previewBase64 = base64)
  }

  def getPreview(uuid: UUID): Either[String, String] =
    get(uuid)(_.previewBase64)

  def getSessions: Seq[SessionInfo] =
    sessionMap.values.toSeq

  def pushJoinerID(hostID: UUID, joinerID: UUID): Unit =
    push(hostID)(_.connInfo.joinerIDs)(joinerID)((si, news) => si.copy(connInfo = si.connInfo.copy(joinerIDs = news)))

  def pullJoinerIDs(hostID: UUID): Either[String, Seq[UUID]] =
    pull(hostID)(_.connInfo.joinerIDs)((si) => si.copy(connInfo = si.connInfo.copy(joinerIDs = Seq())))

  def pushFromHost(hostID: UUID, joinerID: UUID, message: String): Unit = {
    pulseHost(hostID)
    mush(hostID)(_.connInfo.fromHostMap)(joinerID -> message)((si, news) => si.copy(connInfo = si.connInfo.copy(fromHostMap = news)))
  }

  def pullFromHost(hostID: UUID, joinerID: UUID): Either[String, Seq[String]] = {
    pulseHost(hostID)
    pullEither(hostID)(_.connInfo.fromHostMap.get(joinerID).toRight(s"No entry for $joinerID"))(
      (si) => si.copy(connInfo = si.connInfo.copy(fromHostMap = si.connInfo.fromHostMap - joinerID))
    )
  }

  def pushFromJoiner(hostID: UUID, joinerID: UUID, message: String): Unit =
    mush(hostID)(_.connInfo.fromJoinerMap)(joinerID -> message)((si, news) => si.copy(connInfo = si.connInfo.copy(fromJoinerMap = news)))

  def pullFromJoiner(hostID: UUID, joinerID: UUID): Either[String, Seq[String]] =
    pullEither(hostID)(_.connInfo.fromJoinerMap.get(joinerID).toRight(s"No entry for $joinerID"))(
      (si) => si.copy(connInfo = si.connInfo.copy(fromJoinerMap = si.connInfo.fromJoinerMap - joinerID))
    )

  private def get[T](uuid: UUID)(getter: (SessionInfo) => T): Either[String, T] =
    getEither(uuid)(getter andThen Right.apply)

  private def getEither[T](uuid: UUID)(getter: (SessionInfo) => Either[String, T]): Either[String, T] =
    sessionMap
      .get(uuid)
      .toRight("Session not found")
      .flatMap(getter)

  private def pull[T](uuid: UUID)
                     (getter: (SessionInfo) => T)
                     (setter: (SessionInfo) => SessionInfo): Either[String, T] = {
    val out = get(uuid)(getter)
    get(uuid)(identity)
      .map(setter)
      .foreach((si) => sessionMap.update(uuid, si))
    out
  }

  private def pullEither[T](uuid: UUID)
                           (getter: (SessionInfo) => Either[String, T])
                           (setter: (SessionInfo) => SessionInfo): Either[String, T] = {
    val outEither = getEither(uuid)(getter)
    get(uuid)(identity)
      .map(setter)
      .foreach((si) => sessionMap.update(uuid, si))
    outEither
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

  private def mush[T](uuid: UUID)
                     (getter: (SessionInfo) => Map[UUID, Seq[T]])
                     (item: (UUID, T))
                     (setter: (SessionInfo, Map[UUID, Seq[T]]) => SessionInfo): Unit = {
    val olds = get(uuid)(getter).fold(_ => Map[UUID, Seq[T]](), identity _)
    get(uuid)(identity)
      .map((si) => setter(si, olds + (item._1 -> (olds.getOrElse(item._1, Seq()) ++ Seq(item._2)))))
      .foreach((si) => sessionMap.update(uuid, si))
  }

}

case class Model(name: String, source: String, json: String)
case class ConnectionInfo(joinerIDs: Seq[UUID], fromHostMap: Map[UUID, Seq[String]], fromJoinerMap: Map[UUID, Seq[String]])
case class RoleInfo(name: String, var numInRole: Int, limit: Option[Int])

case class SessionInfo( uuid: UUID, name: String, password: Option[String], roleInfo: Map[String, RoleInfo]
                      , connInfo: ConnectionInfo, model: Model, previewBase64: String, lastCheckInTimestamp: Long
                      )
