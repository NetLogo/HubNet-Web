package org.nlogo.hubnetweb.session

import java.util.UUID

import scala.collection.immutable.Map
import scala.collection.mutable.{ LinkedHashMap => LHM, Map => MMap }
import scala.concurrent.duration.FiniteDuration
import scala.io.Source

import akka.actor.typed.ActorRef
import akka.actor.typed.Behavior
import akka.actor.typed.scaladsl.AbstractBehavior
import akka.actor.typed.scaladsl.ActorContext
import akka.actor.typed.scaladsl.Behaviors

import SessionManagerActor.SeshMessage

import IDService.{ genSafeUUID, toUUIDHash }

object SessionManagerActor {

  private type Scheduler = (FiniteDuration, () => Unit) => Unit

  trait SeshMessage

  trait SeshMessageAsk[T] extends SeshMessage {
    def replyTo: ActorRef[T]
  }

  final case class CreateSession( modelName: String, modelSource: String
                                , json: String, name: String
                                , password: Option[String], uuid: UUID
                                , scheduleIn: Scheduler
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

  final case class PushNewJoiner(hostID: UUID
                                , override val replyTo: ActorRef[Option[UUID]]
                                ) extends SeshMessageAsk[Option[UUID]]

  final case class RoleData( hostID: UUID, roleIndex: Int
                           , override val replyTo: ActorRef[Either[String, String]]
                           ) extends SeshMessageAsk[Either[String, String]]

  final case class PulseHost     (hostID: UUID)                                       extends SeshMessage
  final case class PushFromHost  (hostID: UUID, joinerID: UUID, message: String)      extends SeshMessage
  final case class PushFromJoiner(hostID: UUID, joinerID: UUID, message: String)      extends SeshMessage
  final case class RegisterRoles (hostID: UUID, triples:  Seq[(String, Int, String)]) extends SeshMessage
  final case class UpdateNumPeers(hostID: UUID, numPeers: Seq[Int])                   extends SeshMessage
  final case class UpdatePreview (hostID: UUID, base64:   String)                     extends SeshMessage

  def apply(): Behavior[SeshMessage] =
    Behaviors.receive {
      case (context, message) =>
        message match {

          case CreateSession( modelName, modelSource, json, name, password, uuid
                            , scheduleIn, replyTo) =>
            replyTo ! SessionManager.createSession( modelName, modelSource, json
                                                  , name, password, uuid, scheduleIn)
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

          case PulseHost(hostID) =>
            SessionManager.pulseHost(hostID)
            Behaviors.same

          case PushFromHost(hostID, joinerID, msg) =>
            SessionManager.pushFromHost(hostID, joinerID, msg)
            Behaviors.same

          case PushFromJoiner(hostID, joinerID, msg) =>
            SessionManager.pushFromJoiner(hostID, joinerID, msg)
            Behaviors.same

          case PushNewJoiner(hostID, replyTo) =>
            replyTo ! SessionManager.pushNewJoiner(hostID)
            Behaviors.same

          case RegisterRoles(hostID, configs) =>
            SessionManager.registerRoles(hostID, configs)
            Behaviors.same

          case RoleData(hostID, roleIndex, replyTo) =>
            replyTo ! SessionManager.getRoleData(hostID, roleIndex)
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

  def createSession( modelName: String, modelSource: String, json: String
                   , name: String, password: Option[String], uuid: UUID
                   , scheduleIn: Scheduler
                   ): Either[String, String] = {

    val time        = System.currentTimeMillis()
    val image       = GrayB64

    sessionMap += uuid -> SessionInfo( uuid, name, password
                                     , LHM()
                                     , new ConnectionInfo(Vector(), Map(), Map())
                                     , new Model(modelName, modelSource, json)
                                     , image, time
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

  def pulseHost(hostID: UUID): Unit =
    sessionMap.get(hostID).foreach {
      session => sessionMap(hostID) = session.copy(lastCheckInTimestamp = System.currentTimeMillis())
    }

  def registerRoles(hostID: UUID, configs: Seq[(String, Int, String)]): Unit = {

    pulseHost(hostID)

    val infos =
      configs.map({
        case (name, limit, data) => {
          val l = if (limit == -1) None else Some(limit)
          RoleInfo(name, 0, l, data)
        }
      })

    sessionMap.get(hostID).foreach {
      (sm) =>
        infos.foreach((ri) => sm.roleInfo += ri.name -> ri)
    }

  }

  def getRoleData(hostID: UUID, roleIndex: Int): Either[String, String] = {
    val error = s"No such role index '${roleIndex}' in session"
    getEither(hostID)(_.roleInfo.values.toIndexedSeq.lift(roleIndex).map(_.data).toRight(error))
  }

  def updateNumPeers(hostID: UUID, numPeers: Seq[Int]): Unit = {
    pulseHost(hostID)
    sessionMap.get(hostID).foreach {
      (sm) =>
        sm.roleInfo.zip(numPeers).foreach {
          case ((_, ri), num) => ri.numInRole = num
        }
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

  private def pushJoinerID(hostID: UUID, joinerID: UUID): Unit =
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

  def pushNewJoiner(hostID: UUID): Option[UUID] = {

    val hashSet =
      sessionMap
        .get(hostID)
        .fold(Vector[UUID]())(sinfo => sinfo.connInfo.fromHostMap.keys.toVector)
        .map(toUUIDHash)
        .toSet

    val joinerIDOpt = genSafeUUID(hashSet)

    joinerIDOpt.foreach(pushJoinerID(hostID, _))

    joinerIDOpt

  }

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

case class ConnectionInfo( joinerIDs: Vector[UUID]
                         , fromHostMap: Map[UUID, Vector[String]]
                         , fromJoinerMap: Map[UUID, Vector[String]])

case class RoleInfo(name: String, var numInRole: Int, limit: Option[Int], data: String)

case class SessionInfo( uuid: UUID, name: String, password: Option[String]
                      , roleInfo: LHM[String, RoleInfo], connInfo: ConnectionInfo
                      , model: Model, previewBase64: String
                      , lastCheckInTimestamp: Long
                      )
