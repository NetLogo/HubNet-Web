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

  private lazy val descriptions: Map[String, String] =
    fileMappings.mapValues {
      path =>

        val source = Source.fromURI(path.toUri)
        val text   = source.mkString
        source.close()

        val info = text.split("\\Q@#$#@#$#@\\E\n")(2)

        val Regex = """(?msi).*^## WHAT IS IT\?$(.*?)^## (?:HOW IT WORKS$(.*?)^## )?.*""".r

        info match {

          case Regex(what, how) =>
            if (how != null) {
              s"${what.trim}\n\n${how.trim}"
            } else {
              what.trim
            }

          case _ =>
            throw new Error(s"Failed to match info for $path:\n\n$info")

        }

    }

  def getDescriptions(): Map[String, String] = descriptions
  def getFileMappings(): Map[String,   Path] = fileMappings

}
