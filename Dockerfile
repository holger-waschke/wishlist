ARG BUILD_FROM
FROM $BUILD_FROM

FROM alpine:3.22.2
# for simplicity i precompile this binary on my local system for rasperry target archictecture arm64
# GOOS=linux GOARCH=arm64 go build -o wishlist-linux-arm64 ./
 
COPY wishlist-linux-arm64 /usr/bin/wishlist
COPY IMG_1706.jpg .
COPY index.html .

EXPOSE 5000
ENTRYPOINT ["/usr/bin/wishlist"]