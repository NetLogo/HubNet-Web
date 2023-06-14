package org.nlogo.hubnetweb

import java.util.UUID

import scala.collection.Map
import scala.collection.mutable.{ Map => MMap }
import scala.collection.mutable.ListBuffer
import scala.concurrent.duration.FiniteDuration

import akka.actor.typed.ActorRef
import akka.actor.typed.Behavior
import akka.actor.typed.scaladsl.AbstractBehavior
import akka.actor.typed.scaladsl.ActorContext
import akka.actor.typed.scaladsl.Behaviors

import ChatManagerActor.ChatSystemMessage

object ChatManagerActor {

  private type Scheduler = (FiniteDuration, () => Unit) => Unit

  trait ChatSystemMessage

  trait ChatMessageAsk[T] extends ChatSystemMessage {
    def replyTo: ActorRef[T]
  }

  final case class Census(override val replyTo: ActorRef[Int]) extends ChatMessageAsk[Int]

  final case class PullBuffer(uuid: UUID, override val replyTo: ActorRef[List[(Int, String, Boolean)]]) extends ChatMessageAsk[List[(Int, String, Boolean)]]

  final case class LogChat(msg: String, uuid: UUID) extends ChatSystemMessage
  final case class LogTick(             uuid: UUID) extends ChatSystemMessage
  final case class StartLoop(scheduleIn: Scheduler) extends ChatSystemMessage

  def apply(): Behavior[ChatSystemMessage] =
    Behaviors.receive {
      case (context, message) =>
        message match {

          case Census(replyTo) =>
            replyTo ! ChatManager.census
            Behaviors.same

          case LogChat(msg, uuid) =>
            ChatManager.logChat(msg, uuid)
            Behaviors.same

          case LogTick(uuid) =>
            ChatManager.logTick(uuid)
            Behaviors.same

          case PullBuffer(uuid, replyTo) =>
            replyTo ! ChatManager.pullBuffer(uuid)
            Behaviors.same

          case StartLoop(scheduleIn) =>
            ChatManager.startLoop(scheduleIn)
            Behaviors.same

        }

    }

}

private object ChatManager {

  private type Scheduler = (FiniteDuration, () => Unit) => Unit

  private var idCounter     = 0
  private var privilegedNum = -1

  private val idMap   = MMap[UUID,                       Int]()
  private val tickMap = MMap[UUID,                      Long]()
  private val msgMap  = MMap[UUID, ListBuffer[(Int, String)]]()

  def census: Int =
    tickMap.size

  def pullBuffer(uuid: UUID): List[(Int, String, Boolean)] = {
    msgMap.get(uuid).toList.flatMap {
      case buffer =>
        val list = buffer.result()
        buffer.clear()
        list.map { case (num, text) => (num, text, num == privilegedNum) }
    }
  }

  def logChat(msg: String, uuid: UUID): Unit = {

    register(uuid)

    idMap.get(uuid).foreach {
      (id) =>

        if (msg == "ASSUMING DIRECT CONTROL" && false) {
          privilegedNum = id
        } else {
          val sane = sanitize(msg)
          msgMap.foreach {
            case (cid, buffer) =>
              if (cid != uuid) {
                buffer.append(id -> sane)
              }
          }
        }

    }

  }

  def logTick(uuid: UUID): Unit = {
    register(uuid)
    tickMap.put(uuid, System.currentTimeMillis())
    ()
  }

  def startLoop(scheduleIn: Scheduler): Unit = {
    import scala.concurrent.duration.DurationInt
    scheduleIn(30 seconds, {
      () =>
        val currentTS = System.currentTimeMillis()
        tickMap.foreach {
          case (id, ts) =>
            if ((currentTS - ts) >= 30000) {
              tickMap.remove(id)
            }
        }
        startLoop(scheduleIn)
    })
  }

  private def register(uuid: UUID): Unit = {
    if (!idMap.contains(uuid)) {
      val id = idCounter
      idCounter += 1
      idMap.put(uuid, id)
      msgMap.put(uuid, new ListBuffer)
      ()
    }
  }

  private def sanitize(s: String): String =
    s.replaceAll("\"", "\\\"")

}
