FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
ENV MAVEN_OPTS="-Dhttps.protocols=TLSv1.2"
RUN mvn dependency:go-offline
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN groupadd -r wealthynest && useradd -r -g wealthynest wealthynest
COPY --from=build /app/target/wealthynest-api-1.0.0.jar app.jar
RUN chown wealthynest:wealthynest app.jar
USER wealthynest
EXPOSE 8080
ENTRYPOINT ["java","-XX:+UseContainerSupport","-XX:MaxRAMPercentage=75.0","-Djava.security.egd=file:/dev/./urandom","-jar","app.jar"]
