# GECK
Geck makes resourceful API-driven apps dead-easy. It's intended for use backing single-page web applications powered by frontend Javascript frameworks like [Backbone.js](http://documentcloud.github.com/backbone).

## Requirements
* Node.js 0.4+
* Cradle + CouchDB
* Underscore
* Express
* Jade

## Route Map
When a resource is defined, several routes are created. The following method and path combos map to the named definition functions;

    POST    /resource     create
    GET     /resource/id  read
    PUT     /resource/id  update
    DELETE  /resource/id  destroy
    GET     /resource     list

## API
### resource(name [, definition])
This is where the magic happens. All you need is to supply a database name. GECK will automagically find a table by the same name, creating a new one if necessary, and setup full CRUD route access to it! Using the definition you can add some extra functionality like validation or partial rendering.

    geck.resource('users', function(){
      this.validate = function(data){
        return true;
      };
    });

#### definition.validate(data)
Every app needs to validate the data sent to it before saving it. With the validation method you can define some validations that need to pass before GECK saves the data to the database.

#### definition.create/read/update/destroy/list(req, res)
All the CRUD routes that GECK defines can also be overwritten. The defaults look just like this;

    this.read = function(req, res){
      req.geck.on('error', function(err){
        res.json({ success: false, error: err });
      }).on('success', function(doc){
        res.json({ success:true, response: doc });
      });
    };

##### req.geck
This is the EventEmitter instance that GECK uses to notify the routes when the requested data has either been retrieved successfully, or something went wrong. It supplies just two events; 'error' and 'success'. The error event receives the error message or object, while the success event receives the raw document returned by the database.

##### res.json/html
These provides a simple method of returning JSON or HTML data to the client.

##### res.tmpl
This allows for simple rendering of jade templates to return to the client.

#### definition.base = (string)
This is used to specify the base directory to attach all routes to. For example; one might use '/api' to expose all GECK-backed routes under that directory rather than root. Default: ''

#### definition.destructive = (bool)
If destructive is enabled, updates will replace the entire current doc with the supplied data. When disabled, the supplied data will simply be merged over the existing data. Default: true

#### definition.allow_forced_ids = (bool)
Allows creation requests to be made to a URL like /resource/id to use a specific id, rather than letting the database decide the ID itself. Default: false

#### definition.include_docs_in_list = (bool)
When enabled, document content will be included when viewing /resource. This is enabled by default, but I would recommend disabling this for larger datasets or your queries could become very slow. Default: true

### database([config])
Prepares the CouchDB connection and passes the config, if present, to cradle.setup(). Calling this should only be necessary if the database is not on localhost with the default settings, as the first resource definition will call this if the connection is not yet available.

### defaults(definition)
This accepts the same format of definition object as resource(). But this will apply the supplied definition to the defaults used for all future calls to resource().

### listen(port | app)
You can either specify a port number for the GECK instance to listen to, or you can attach it to an existing express server.

---

### Copyright (c) 2011 Stephen Belanger
#### Licensed under MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.