/*jslint devel: true, node: true, passfail: false, nomen: true, vars: true, indent: 4, maxlen: 120 */
"use strict";

var PORT = 1234;

var _ = require('underscore'),
    events = require('events'),
    net = require('net'),
    uuid = require('uuid'),
    yaml = require('js-yaml');
_.mixin(require('underscore.string').exports());

var clients = {};
// Support for different transport types
var dataTypes = {
    yaml: {
        parse: yaml.safeLoad,
        render: yaml.safeDump
    },
    json: {
        parse: JSON.parse,
        render: JSON.stringify
    }
};


var printData = function (data) {
    console.log(dataTypes.yaml.render(data) + '\n');
};


// Error type used when the client did something wrong
var ClientError = function (type, info, message) {
    this.name = 'ClientError';
    this.message = message;
    this.data = {
        cmd: 'error',
        type: type,
        info: info,
        message: message
    };
};
ClientError.prototype = new Error();
ClientError.prototype.constructor = ClientError;

// Methods and data representing the client
var Client = function (dataType, socket) {
    this.id = uuid.v4();
    this.denied = [];
    if (dataTypes.hasOwnProperty(dataType)) {
        this.dataParse = dataTypes[dataType].parse;
        this.dataRender = dataTypes[dataType].render;
    } else {
        throw new ClientError('not found', 'dataType', 'Data type ' + dataType + ' not supported');
    }
    this.socket = socket;
};
Client.prototype.send = function (data) {
    this.socket.write(this.dataRender(data));
};
Client.prototype.deny = function (by, clientsLength) {
    if (_.contains(this.denied, by)) {
        throw new ClientError('redundant', 'already denied', 'You have already denied the connection of ' + this.id);
    } else {
        this.denied.push(by);
        this.send({cmd: 'denied', by: by.id});
        if (this.denied.length >= clientsLength / 2) {
            var deniedBy = [];
            _.each(this.denied, function (x) { deniedBy.push(x.id); });
            this.disconnect({why: 'denied', by: deniedBy});
        }
    }
};
Client.prototype.disconnect = function (reason) {
    reason.cmd = 'end';
    this.send(reason);
    this.socket.end();
    
    reason.cmd = 'peer left';
    reason.id = this.id;
    printData(reason);
    
    delete clients[this.id];
    _.each(clients, function (client) {
        client.send(reason);
    });
};


var server = net.createServer(function (socket) {
    socket.setEncoding('utf8');
    
    // Get information on data type
    socket.once('data', function (recv) {
        var dataType, client;
        
        try {
            dataType = recv.trim();
            client = new Client(dataType, socket);
        } catch (e) {
            if (e instanceof ClientError) {
                socket.end('ERROR ' + e.data.info + ' ' + e.data.type + ', ' + e.data.message);
                return;
            } else { throw e; }
        }
        
        clients[client.id] = client;
        
        // Welcome the client to this world
        client.send({cmd: 'welcome', id: client.id});
        
        // Notify all other clients that someone has connected
        var connectData = {cmd: 'peer connected', id: client.id};
        printData(connectData);
        _.each(clients, function (sendTo) {
            if (sendTo !== client) {
                sendTo.send(connectData);
            }
        });
        
        // Actual data handler
        socket.on('data', function (recv) {
            // Ensure the data is operable
            try {
                recv = recv.trim();
                if (recv === '') {
                    throw new SyntaxError('No data sent');
                }
                var data = client.dataParse(recv);
                data.from = client.id;

                printData(data);

                try {
                    if (data.cmd === 'quit') {
                        client.disconnect({why: 'client request'});
                    } else if (data.cmd === 'list peers') {
                        var peers = [];
                        _.each(clients, function (peer) {
                            if (peer !== client) {
                                peers.push(peer.id);
                            }
                        });
                        client.send({cmd: 'RES:list peers', peers: peers});
                    } else if (data.cmd === 'deny') {
                        // Some client doesn't want another client there
                        var toDeny = clients[data.id];
                        toDeny.deny(client, Object.keys(clients).length);
                        client.send({
                            cmd: 'RES:deny',
                            success: true,
                            denied: toDeny.denied.length
                        });
                    } else if (data.to instanceof Array) {
                        // Only forward to given ids
                        _.each(data.to, function (sendTo) {
                            sendTo = clients[sendTo];
                            sendTo.send(data);
                        });
                    } else if (data.to instanceof String) {
                        // Only forward to given id
                        var sendTo = clients[data.to];
                        sendTo.send(data);
                    } else {
                        // Not a system command, forward to everyone
                        _.each(clients, function (sendTo) {
                            if (sendTo !== client) {
                                sendTo.send(data);
                            }
                        });
                    }
                } catch (ce) {
                    if (ce instanceof ClientError) {
                        client.send({
                            cmd: 'ERROR',
                            type: ce.type,
                            info: ce.info,
                            message: ce.message
                        });
                    } else { throw ce; }
                }
            } catch (e) {
                if (e instanceof SyntaxError) {
                    client.send({
                        cmd: 'ERROR',
                        type: 'syntax',
                        info: '',
                        message: e.message
                    });
                } else {
                    client.send({
                        cmd: 'SERVER ERROR'
                    });
                    console.log(e.stack);
                }
            }
        });
    });
});


server.listen(PORT, function () {
    console.log('localhost:' + PORT);
});
