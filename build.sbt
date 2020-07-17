name := "HubNetWeb"

version := "1.0-SNAPSHOT"

scalaVersion := "2.12.8"

scalacOptions ++= Seq(
  "-encoding", "UTF-8",
  "-deprecation",
  "-unchecked",
  "-feature",
  "-language:_",
  "-Ywarn-value-discard",
  "-Xfatal-warnings"
)

libraryDependencies ++= Seq(
  "com.typesafe.akka" %% "akka-actor-typed"     % "2.6.6",
  "com.typesafe.akka" %% "akka-http"            % "10.1.12",
  "com.typesafe.akka" %% "akka-http-spray-json" % "10.1.12",
  "com.typesafe.akka" %% "akka-stream"          % "2.6.6"
)

