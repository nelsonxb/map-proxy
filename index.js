#!/usr/bin/env node
"use strict";

var tcp = require('net')

var server = tcp.createServer(function (conn) {
  socket.on('data', function (data) {
    socket.end(data)
  })
})

server.listen(2345, function () {
  console.log('Server ready on :2345')
})
