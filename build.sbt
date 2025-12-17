name := "HubNetWeb"

version := "1.0-SNAPSHOT"

scalaVersion := "3.7.0"

scalacOptions ++= Seq(
  "-encoding", "UTF-8",
  "-deprecation",
  "-unchecked",
  "-feature",
  "-Xfatal-warnings"
)

resolvers += "netlogoheadless" at "https://dl.cloudsmith.io/public/netlogo/netlogo/maven/"

libraryDependencies ++= Seq(
  "com.typesafe.akka" %% "akka-actor-typed"     % "2.8.2",
  "com.typesafe.akka" %% "akka-http"            % "10.5.2",
  "com.typesafe.akka" %% "akka-http-spray-json" % "10.5.2",
  "com.typesafe.akka" %% "akka-stream"          % "2.8.2",
  "org.slf4j"         %  "slf4j-simple"         % "2.0.7",
  "org.nlogo"         %  "netlogoheadless"      % "7.0.2"
)
