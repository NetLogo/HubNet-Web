package org.nlogo.hubnetweb

import java.nio.file.{ Files, Path, Paths }

import scala.io.Source

object ModelsLibrary {

  private lazy val fileMappings: Map[String, Path] = {
    import scala.collection.JavaConverters.asScalaIteratorConverter
    val path  = Paths.get("./models/")
    val files = Files.walk(path).filter(_.getFileName.toString.endsWith(".nlogo"))
    val paths = files.iterator.asScala.toVector
    paths.map(x => (x.getFileName.toString.stripSuffix(" HubNet.nlogo"), x)).toMap
  }

  def getFileMappings(): Map[String, Path] = fileMappings

}
