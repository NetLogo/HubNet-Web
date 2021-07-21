package org.nlogo.hubnetweb.session

import java.util.UUID

import scala.collection.Map
import scala.collection.mutable.{ Map => MMap }
import scala.concurrent.duration.FiniteDuration
import scala.io.Source

import akka.actor.typed.ActorRef
import akka.actor.typed.Behavior
import akka.actor.typed.scaladsl.AbstractBehavior
import akka.actor.typed.scaladsl.ActorContext
import akka.actor.typed.scaladsl.Behaviors

import SessionManagerActor.SeshMessage

object SessionManagerActor {

  private type Scheduler = (FiniteDuration, () => Unit) => Unit

  trait SeshMessage

  trait SeshMessageAsk[T] extends SeshMessage {
    def replyTo: ActorRef[T]
  }

  final case class CreateSession( modelName: String, modelSource: String, name: String, password: Option[String]
                                , uuid: UUID, scheduleIn: Scheduler
                                , override val replyTo: ActorRef[Either[String, String]]
                                ) extends SeshMessageAsk[Either[String, String]]

  final case class CreateXSession( modelName: String, modelSource: String, json: String, name: String
                                 , password: Option[String], uuid: UUID, scheduleIn: Scheduler
                                 , override val replyTo: ActorRef[Either[String, String]]
                                 ) extends SeshMessageAsk[Either[String, String]]

  final case class DelistSession(uuid: UUID) extends SeshMessage

  final case class GetPreview( uuid: UUID, override val replyTo: ActorRef[Either[String, String]]
                             ) extends SeshMessageAsk[Either[String, String]]

  final case class GetSessions( override val replyTo: ActorRef[Vector[SessionInfo]]
                              ) extends SeshMessageAsk[Vector[SessionInfo]]

  final case class PullFromHost( hostID: UUID, joinerID: UUID
                               , override val replyTo: ActorRef[Either[String, Vector[String]]]
                               ) extends SeshMessageAsk[Either[String, Vector[String]]]

  final case class PullFromJoiner( hostID: UUID, joinerID: UUID
                                 , override val replyTo: ActorRef[Either[String, Vector[String]]]
                                 ) extends SeshMessageAsk[Either[String, Vector[String]]]

  final case class PullJoinerIDs(hostID: UUID
                                , override val replyTo: ActorRef[Either[String, Vector[UUID]]]
                                ) extends SeshMessageAsk[Either[String, Vector[UUID]]]

  final case class PushFromHost  (hostID: UUID, joinerID: UUID, message: String) extends SeshMessage
  final case class PushFromJoiner(hostID: UUID, joinerID: UUID, message: String) extends SeshMessage
  final case class PushJoinerID  (hostID: UUID, joinerID: UUID)                  extends SeshMessage
  final case class UpdateNumPeers(hostID: UUID, numPeers: Int)                   extends SeshMessage
  final case class UpdatePreview (hostID: UUID, base64: String)                  extends SeshMessage

  def apply(): Behavior[SeshMessage] =
    Behaviors.receive {
      case (context, message) =>
        message match {

          case CreateSession(modelName, modelSource, name, password, uuid, scheduleIn, replyTo) =>
            replyTo ! SessionManager.createSession(modelName, modelSource, name, password, uuid, scheduleIn)
            Behaviors.same

          case CreateXSession(modelName, modelSource, json, name, password, uuid, scheduleIn, replyTo) =>
            replyTo ! SessionManager.createXSession(modelName, modelSource, json, name, password, uuid, scheduleIn)
            Behaviors.same

          case DelistSession(uuid) =>
            SessionManager.delistSession(uuid)
            Behaviors.same

          case GetPreview(uuid, replyTo) =>
            replyTo ! SessionManager.getPreview(uuid)
            Behaviors.same

          case GetSessions(replyTo) =>
            replyTo ! SessionManager.getSessions
            Behaviors.same

          case PullFromHost(hostID, joinerID, replyTo) =>
            replyTo ! SessionManager.pullFromHost(hostID, joinerID)
            Behaviors.same

          case PullFromJoiner(hostID, joinerID, replyTo) =>
            replyTo ! SessionManager.pullFromJoiner(hostID, joinerID)
            Behaviors.same

          case PullJoinerIDs(hostID, replyTo) =>
            replyTo ! SessionManager.pullJoinerIDs(hostID)
            Behaviors.same

          case PushFromHost(hostID, joinerID, msg) =>
            SessionManager.pushFromHost(hostID, joinerID, msg)
            Behaviors.same

          case PushFromJoiner(hostID, joinerID, msg) =>
            SessionManager.pushFromJoiner(hostID, joinerID, msg)
            Behaviors.same

          case PushJoinerID(hostID, joinerID) =>
            SessionManager.pushJoinerID(hostID, joinerID)
            Behaviors.same

          case UpdateNumPeers(hostID, numPeers) =>
            SessionManager.updateNumPeers(hostID, numPeers)
            Behaviors.same

          case UpdatePreview(hostID, base64) =>
            SessionManager.updatePreview(hostID, base64)
            Behaviors.same

        }

    }

}

private object SessionManager {

  private type Scheduler = (FiniteDuration, () => Unit) => Unit

  private val sessionMap: MMap[UUID, SessionInfo] = MMap()

  def createSession( modelName: String, modelSource: String, name: String, password: Option[String]
                   , uuid: UUID, scheduleIn: Scheduler
                   ): Either[String, String] = {

    val time        = System.currentTimeMillis()
    val anyRoleInfo = RoleInfo("any", 0, None)
    val image       = GrayB64

    sessionMap += uuid -> SessionInfo( uuid, name, password, Map("any" -> anyRoleInfo)
                                     , new ConnectionInfo(Vector(), Map(), Map())
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
    val image       = GrayB64

    sessionMap += uuid -> SessionInfo( uuid, name, password, Map("any" -> anyRoleInfo)
                                     , new ConnectionInfo(Vector(), Map(), Map())
                                     , new Model(modelName, modelSource, json), image, time
                                     )

    {

      import scala.concurrent.duration.DurationInt

      scheduleIn(25 hours, {
        () =>
          delistSession(uuid)
          ()
      })

      scheduleIn(1 minute, () => checkIn(scheduleIn)(uuid))

    }

    Right(uuid.toString)

  }

  private def checkIn(scheduleIn: Scheduler)(hostID: UUID): Unit = {

    import scala.concurrent.duration.DurationInt

    sessionMap.get(hostID).foreach {
      session =>
        val timestamp = session.lastCheckInTimestamp
        if (timestamp > (System.currentTimeMillis() - (1 * 60 * 1000)))
          scheduleIn(1 minute, () => checkIn(scheduleIn)(hostID))
        else
          delistSession(hostID)
    }

    ()

  }

  def delistSession(hostID: UUID): Unit = {
    sessionMap -= hostID
  }

  private def pulseHost(hostID: UUID): Unit =
    sessionMap.get(hostID).foreach {
      session => sessionMap(hostID) = session.copy(lastCheckInTimestamp = System.currentTimeMillis())
    }

  def updateNumPeers(hostID: UUID, numPeers: Int): Unit = {
    pulseHost(hostID)
    sessionMap.get(hostID).foreach {
      _.roleInfo("any").numInRole = numPeers
    }
  }

  def updatePreview(hostID: UUID, base64: String): Unit = {
    pulseHost(hostID)
    sessionMap.get(hostID).foreach {
      session => sessionMap(hostID) = session.copy(previewBase64 = base64)
    }
  }

  def getPreview(uuid: UUID): Either[String, String] =
    get(uuid)(_.previewBase64)

  def getSessions: Vector[SessionInfo] =
    sessionMap.values.toVector

  def pushJoinerID(hostID: UUID, joinerID: UUID): Unit =
    push(hostID)(_.connInfo.joinerIDs)(joinerID)((si, news) => si.copy(connInfo = si.connInfo.copy(joinerIDs = news)))

  def pullJoinerIDs(hostID: UUID): Either[String, Vector[UUID]] =
    pull(hostID)(_.connInfo.joinerIDs)((si) => si.copy(connInfo = si.connInfo.copy(joinerIDs = Vector())))

  def pushFromHost(hostID: UUID, joinerID: UUID, message: String): Unit = {
    pulseHost(hostID)
    mush(hostID)(_.connInfo.fromHostMap)(joinerID -> message)((si, news) => si.copy(connInfo = si.connInfo.copy(fromHostMap = news)))
  }

  def pullFromHost(hostID: UUID, joinerID: UUID): Either[String, Vector[String]] = {
    pulseHost(hostID)
    pullEither(hostID)(_.connInfo.fromHostMap.get(joinerID).toRight(s"No entry for $joinerID"))(
      (si) => si.copy(connInfo = si.connInfo.copy(fromHostMap = si.connInfo.fromHostMap - joinerID))
    )
  }

  def pushFromJoiner(hostID: UUID, joinerID: UUID, message: String): Unit =
    mush(hostID)(_.connInfo.fromJoinerMap)(joinerID -> message)((si, news) => si.copy(connInfo = si.connInfo.copy(fromJoinerMap = news)))

  def pullFromJoiner(hostID: UUID, joinerID: UUID): Either[String, Vector[String]] =
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
                     (getter: (SessionInfo) => Vector[T])
                     (item: T)
                     (setter: (SessionInfo, Vector[T]) => SessionInfo): Unit = {
    val olds = get(uuid)(getter).fold(_ => Vector(), identity _)
    get(uuid)(identity)
      .map((si) => setter(si, olds :+ item))
      .foreach((si) => sessionMap.update(uuid, si))
  }

  private def mush[T](uuid: UUID)
                     (getter: (SessionInfo) => Map[UUID, Vector[T]])
                     (item: (UUID, T))
                     (setter: (SessionInfo, Map[UUID, Vector[T]]) => SessionInfo): Unit = {
    val olds = get(uuid)(getter).fold(_ => Map[UUID, Vector[T]](), identity _)
    get(uuid)(identity)
      .map((si) => setter(si, olds + (item._1 -> (olds.getOrElse(item._1, Vector()) ++ Vector(item._2)))))
      .foreach((si) => sessionMap.update(uuid, si))
  }

  private val GrayB64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4wYGEwkDoISeKgAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAADElEQVQI12NobmwEAAMQAYa2CjzCAAAAAElFTkSuQmCC"

}

case class Model(name: String, source: String, json: String)
case class ConnectionInfo(joinerIDs: Vector[UUID], fromHostMap: Map[UUID, Vector[String]], fromJoinerMap: Map[UUID, Vector[String]])
case class RoleInfo(name: String, var numInRole: Int, limit: Option[Int])

case class SessionInfo( uuid: UUID, name: String, password: Option[String], roleInfo: Map[String, RoleInfo]
                      , connInfo: ConnectionInfo, model: Model, previewBase64: String, lastCheckInTimestamp: Long
                      )
