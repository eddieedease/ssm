# Mimics a typical shared host: Apache + mod_php + .htaccess support.
FROM php:8.4-apache

ARG HOST_UID=1000

RUN apt-get update \
 && apt-get install -y --no-install-recommends libzip-dev \
 && docker-php-ext-install pdo_mysql zip \
 && a2enmod rewrite headers \
 && usermod -u "${HOST_UID}" www-data \
 && groupmod -g "${HOST_UID}" www-data \
 && rm -rf /var/lib/apt/lists/*

COPY php.ini /usr/local/etc/php/conf.d/ssm.ini
