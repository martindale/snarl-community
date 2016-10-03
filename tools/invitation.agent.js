var rest = require('restler');

var Remote = require('maki-remote');
var remote = new Remote('http://localhost:9200');

var channelNameMap = {};

var SLACK_TOKEN = 'place admin token here';

remote.on('close', function (e) {
  console.error('closed:', e);
});

remote.on('error', function (e) {
  console.trace('error:', e);
});

remote.on('message', function(msg) {
  console.log('message received:', msg);
  
  if (msg.method === 'patch') {
    var ops = msg.params.ops;
    if (!ops.length) return;
    
    ops.forEach(function(op) {
      if (msg.params.channel === '/invitations') {
        var invitation = op.value;
        console.log('invitation:', invitation);
        
        // TODO: investigate whether Slack API allows this...
        var channels = invitation.topics.map(function(topic) {
          return channelNameMap[topic].id;
        });
        
        console.log('channels to submit to:', channels);

        rest.post('https://slack.com/api/users.admin.invite', {
          data: {
            email: invitation.email,
            channels: channels.join(','),
            extra_message: invitation.message,
            token: SLACK_TOKEN
          }
        }).on('complete', function(data) {
          if (!data) return console.error('Error connecting to Slack.  Check network connection.');
          if (data.error) return console.error('Error inviting user:', data.error);
          console.log('slack API request returned:', data);
        });
      }
      
      if (msg.params.channel === '/people') {
        console.log('person!', JSON.stringify(op));
      }
    });

  }

});

remote.on('open', function() {
  console.log('remote is open.  monitoring', Object.keys(channelNameMap).length , 'channels.');
});

rest.post('https://slack.com/api/channels.list', {
  data: {
    token: SLACK_TOKEN
  }
}).on('complete', function(data) {
  if (!data) return console.error('Error connecting to Slack.  Check network connection.');
  if (data.error) return console.error('Error listing channels:', data.error);
  if (!data.channels) return console.error('Data contained no channels.');
  
  data.channels.forEach(function(channel) {
    channelNameMap[channel.name] = channel;
  });  
  remote.init({ reconnect: true }, function(err) {
    if (err) console.error('Could not connect to host: must be online for first start!');
  
    remote._get('/invitations', {
      status: 'created'
    }, function(err, invitations) {
      if (err) console.error(err);
       
      invitations.filter(function(x) {
        return x.status === 'created';
      }).forEach(function(invitation) {
        rest.post('https://slack.com/api/users.admin.invite', {
          data: {
            email: invitation.email,
            token: SLACK_TOKEN
          }
        }).on('complete', function(data) {
          if (!data) return console.error('Error connecting to Slack.  Check network connection.');
          if (data.error) return console.error('Error inviting user:', data.error);

          console.log('slack API request returned:', data);

          remote.patch('/invitations/' + invitation.id , {
            status: 'sent'
          }, function(err) {
            if (err) console.error(err);
            console.log('patched invitation:', invitation);
          });
        });
      });
      
    });
  });
});
