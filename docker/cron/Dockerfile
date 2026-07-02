FROM alpine:3.20
# busybox's own crond (already in the base image) is used, not the dcron
# package — dcron's crond calls setpgid on itself and fails as container PID 1.
RUN apk add --no-cache curl tzdata
ENV TZ=Australia/Adelaide

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
