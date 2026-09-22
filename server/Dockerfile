# ===== DEV: hot reload bằng spring-boot-devtools =====
FROM maven:3.9-eclipse-temurin-17 AS dev
WORKDIR /app
EXPOSE 8080
CMD ["mvn", "spring-boot:run"]

# ===== PROD: build jar rồi chạy =====
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -DskipTests -B

FROM eclipse-temurin:17-jre AS prod
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]