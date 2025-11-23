ARG BUILD_FROM
FROM $BUILD_FROM

FROM alpine:3.22.2
# for simplicity i precompile this binary on my local system for rasperry target archictecture arm64
# GOOS=linux GOARCH=arm64 go build -o wishlist-linux-arm64 ./
 
RUN apk add --no-cache su-exec

# create app user
RUN adduser -D app


WORKDIR /app
COPY --chown=app:nobody . /app 
RUN chmod a+x /app/run.sh

EXPOSE 5000
CMD ["/app/run.sh"]