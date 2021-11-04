package org.nlogo.hubnetweb.session

import java.util.UUID

private[session] object IDService {

  private val MaxHash = 256

  def genSafeUUID(knownHashes: Set[Int]): Option[UUID] = {

    def gen(): UUID = {
      val uuid = UUID.randomUUID()
      if (!knownHashes.contains(toUUIDHash(uuid)))
        uuid
      else
        gen()
    }

    if (knownHashes.size < MaxHash)
      Option(gen())
    else
      None

  }

  def toUUIDHash(uuid: UUID): Int = {
    val genHash    = (acc: Int, x: Int) => (((acc << 5) - acc) + x) | 0
    val codePoints = uuid.toString.map(_.toInt)
    val baseHash   = codePoints.foldLeft(0)(genHash)
    Math.abs(baseHash) % MaxHash;
  }

}
