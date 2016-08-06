var rest = require('restler');

var Remote = require('maki-remote');
var remote = new Remote('http://localhost:9200');

module.exports = {
  '{USER:NEW}': function(msg, cb) {
    var slack = this;

    console.log('new user received in plugin:', msg);
    var person = msg.user;
    
    // TODO: use maki-remote
    rest.put('http://localhost:9200/people/' + person.name, {
      headers: {
        'Accept': 'application/json'
      },
      data: {
        id: person.name,
        username: person.name,
        name: {
          given: person.profile.first_name,
          family: person.profile.last_name
        },
        email: person.profile.email,
        bio: person.profile.title,
        image: {
          original: person.profile.image_original,
          avatar: person.profile.image_192,
        },
        links: {
          slack: person.id
        }
      }
    }).on('complete', function(result, response) {
      console.log('person result:', person.name, result, response.statusCode);

      var filter = encodeURIComponent(JSON.stringify({ email: person.profile.email }));
      remote._get('/invitations?filter=' + filter, function(invitations) {
        console.log('invitations retrieved:', invitations.length);
        // temporary filter until Maki API supports this
        var filtered = invitations.filter(function(x) {
          return x.email === person.profile.email;
        });
        
        console.log('invitations filtered:', filtered);
        
        filtered.forEach(function(invite) {
          var topics = [];
          invite.topics.forEach(function(topic) {
            topic.split(',').forEach(function(t) {
              topics.push(t);
            });
          });
          
          console.log('full topic list:', topics);
          
          topics.forEach(function(topic) {
            slack.__rpc('channels.invite', {
              channel: slack.channelNameMap[topic].id,
              user: person.id
            }, function(err, result) {
              console.log('invite result:', err, result);
            });
          });
        });
      });
    });
    
  }
}
