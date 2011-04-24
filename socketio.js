function Socketio() {
}

// url handling
Socketio.prototype.index = function(req, res) {
    console.log('Opening up the socket.io sample');
    var loginName='';
    if (req.session.oauth) {
        loginName = req.session.user.name;
    }

    res.render('socketio/index', {layout: 'socketio/layout', locals:{loginName:loginName}});
};

// socket io configuration
var io = require('socket.io');
var buffer = [];
var clients = [];
var Redis = require('./redis');
var redis = new Redis();

redis.obtainMessages(function(replies) {
    replies.forEach(function (reply, i) {
        var chat = JSON.parse(reply);
        buffer.push(chat);
    });
    buffer.reverse();
});

Socketio.prototype.init = function(app) {
    io = io.listen(app);

    io.on('connection', function(client) {
        client.send({ buffer: buffer });

        client.on('message', function(message) {
            if ('newName' in message) {
                console.log("Received a new name: " + message.newName);
                clients[client.sessionId] = message.newName;
                client.broadcast({ announcement: clients[client.sessionId] + ' connected' });
                sendClients(client);
                return;
            }
            var msg = { chat: [clients[client.sessionId], message.message] };
            buffer.push(msg);
            if (buffer.length > 15) buffer.shift();
            client.broadcast(msg);
            io.emit('newMessage',msg);
        });

        client.on('disconnect', function() {
            client.broadcast({ announcement: clients[client.sessionId] + ' disconnected' });
            removeClient(client.sessionId);
            sendClients(client)
        });
    });

    io.on('newMessage', function(obj) {
        console.log("Received a new message: %s by %s", obj.chat[1], obj.chat[0]);
        redis.storeMessage(JSON.stringify(obj));
    });

    function removeClient(id) {
        delete clients[id];
    }

    function sendClients(client) {
        var curClients = [];
        for (var i in clients) {
            curClients[curClients.length] = clients[i];
        }
        console.log("Number of clients: " + curClients);
        client.broadcast({users: curClients});
        client.send({users: curClients});
    }
};

module.exports = Socketio;
