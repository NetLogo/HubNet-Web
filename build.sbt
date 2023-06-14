name := "HubNetWeb"

version := "1.0-SNAPSHOT"

scalaVersion := "2.13.11"

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
  "com.typesafe.akka" %% "akka-actor-typed"     % "2.8.2",
  "com.typesafe.akka" %% "akka-http"            % "10.5.2",
  "com.typesafe.akka" %% "akka-http-spray-json" % "10.5.2",
  "com.typesafe.akka" %% "akka-stream"          % "2.8.2",
  "org.slf4j"         %  "slf4j-simple"         % "2.0.7"
)
