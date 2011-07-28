// GECK is chainable, yay!
require('..')

// Define a users resource.
// Resource definitions can be in function or object form.
.resource('users', function(){
  // Simple validation, just requires the key exists.
  var required = ['email', 'webname', 'name'];
  this.validate = function(data) {
    for (var key in required) {
      if (typeof required[key] === 'undefined') { return false; }
    }
    return true;
  };
})

// Define articles resource.
.resource('articles')

// Make a home page route using the template system.
.get('/', function(req, res) {
  res.tmpl('example', { content: 'Welcome to GECK.', title: 'GECK' });
})

// Make a catch-all json error for uncaught requests.
.get('*', function(req, res) {
  res.json({ error: 'No interface.' });
})

// Start listening.
.listen(8080);
console.log('listening on port 8080');