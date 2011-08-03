/**
 * Geck.resource - Resource builder for GECK. 
 * 
 * Copyright (c) 2011 Stephen Belanger
 * Licensed under MIT License
 */
var Store = require('./store');
var _ = require('underscore');
var Inflect = require('inflectjs');

/**
 * Resource Constructor.
 * 
 * Prepare a named resource to be built.
 */
function Resource(name, def, ctx){
  if ( ! (this instanceof Resource)) {
    return new Resource(db, def);
  }

  // Make sure name is singular.
  this.name = name;
  this.def = def;
  this.geck = ctx;

  // Make sure the database is ready and associate with this resource.
  this.db = new Store(def.db.type, {
    database: Inflect.plural(def.db.name)
    , collection: Inflect.plural(this.name)
  });
}

/**
 * Builds the resource routes.
 * 
 * This needs some serious refactoring to DRY up the relational routes.
 */
Resource.prototype.build = function(ctx) {
  var self = this;

  /*********
   * Create
   *********/
  ctx.route('post', '/'+self.name+'/:id?', function(req, res) {
    // Ensure request body exists.
    if ( ! req.body) { req.body = {}; }
    self.def.create(req, res);

    // Store the creation process for later.
    var create = function() {
      // Run Validations.
      if ( ! self.def.validate(req.body)) {
        req.geck.emit('error', 'Validation failure.');
      
      // Validation succeeded. Attempt the creation.
      } else {
        // Prepend id, if available.
        if (self.def.allow_forced_ids && req.params.id) {
          req.body.id = req.params.id;
        
        // Remove the ID, if allow_forced_ids is
        // disabled and an id is present.
        } else if ( ! self.def.allow_forced_ids && typeof req.body !== 'undefined' && req.body.id) {
          delete req.body.id;
        }

        // Make our dynamically structured database call.
        self.db.create(req.body||{}, function(err, doc) {
          self.def.after_create(doc);
          req.geck.emit(err ? 'error' : 'success', err ? err : doc);
        });
      }
    };

    // Check non-existence, if id supplied.
    if (self.def.allow_forced_ids && req.params.id) {
      self.db.read(req.params.id, function(err, doc) {
        if (err) {
          req.geck.emit('error', 'That id is in use.');
        } else {
          create();
        }
      });
    
    // Otherwise, just jump into our creator.
    } else {
      create();
    }
  });

  /*********
   * Read
   *********/
  ctx.route('get', '/'+self.name+'/:id', function(req, res) {
    self.def.read(req, res);
    self.db.read(req.params.id, function(err, doc) {
      req.geck.emit(err ? 'error' : 'success', err ? err : doc);
    });
  });

  /*********
   * Update
   *********/
  ctx.route('put', '/'+self.name+'/:id', function(req, res) {
    self.def.update(req, res);

    // Remove _id, if allow_forced_ids is not enabled.
    if ( ! self.def.allow_forced_ids) { delete req.body._id; }

    // Run validations.
    if ( ! self.def.validate(req.body)) {
      req.geck.emit('error', 'Validation failure.');

    // Validation succeeded. Attempt the update.
    } else {
      self.db.update(req.params.id, req.body, function(err, doc) {
        self.def.after_update(doc);
        req.emit(err ? 'error' : 'success', err ? err : doc);
      });
    }
  });

  /*********
   * Destroy
   *********/
  ctx.route('del', '/'+self.name+'/:id', function(req, res) {
    self.def.destroy(req, res);
    self.db.destroy(req.params.id, function(err, doc) {
      req.geck.emit(err ? 'error' : 'success', err ? err : doc);
    });
  });

  /*********
   * List
   *********/
  ctx.route('get', '/'+Inflect.plural(self.name), function(req, res) {
    self.def.list(req, res);
    self.db.list(function(err, doc) {
      req.geck.emit(err ? 'error' : 'success', err ? err : doc);
    });
  });


  /****************************************
   * 
   * Define one-to-many relational routes.
   * 
   ****************************************/
  _.each(self.def.many, function(relation){
    // Ensure singularization.
    relation = Inflect.singular(relation);

    // We need a different db connection for the relations.
    var relation_db = new Store(self.def.db.type, {
      database: self.def.db.name
      , collection: Inflect.plural(relation)
    });

    /*********
     * Create
     *********/
    ctx.route('post', '/'+self.name+'/:id/'+relation, function(req, res) {
      self.def.create(req, res);
      var data = req.body || {};
      data[self.name+'_id'] = req.params.id;

      relation_db.create(data, function(err, doc) {
        req.geck.emit(err ? 'error' : 'success', err ? err : doc);
      });
    });

    /*********
     * Update
     *********/
    ctx.route('put', '/'+self.name+'/:id/'+relation+'/:relation_id', function(req, res) {
      self.def.update(req, res);
      var data = req.body || {};
      data[self.name+'_id'] = req.params.id;

      relation_db.update(req.params.relation_id, data, function(err, doc) {
        req.geck.emit(err ? 'error' : 'success', err ? err : doc);
      });
    });

    /*********
     * Read
     *********/
    ctx.route('get', '/'+self.name+'/:id/'+relation+'/:relation_id', function(req, res) {
      self.def.read(req, res);
      relation_db.read(req.params.relation_id, function(err, doc) {
        req.geck.emit(err ? 'error' : 'success', err ? err : doc);
      });
    });

    /*********
     * Destroy
     *********/
    ctx.route('del', '/'+self.name+'/:id/'+relation+'/:relation_id', function(req, res) {
      self.def.destroy(req, res);
      relation_db.destroy(req.params.relation_id, function(err, doc) {
        req.geck.emit(err ? 'error' : 'success', err ? err : doc);
      });
    });

    /*********
     * List
     *********/
    ctx.route('get', '/'+self.name+'/:id/'+Inflect.plural(relation), function(req, res) {
      self.def.read(req, res);
      criteria = req.query || {};
      criteria[self.name+'_id'] = req.params.id;
      relation_db.list(criteria, function(err, doc) {
        req.geck.emit(err ? 'error' : 'success', err ? err : doc);
      });
    });
  });


  /****************************************
   * 
   * Define one-to-one relational routes.
   * 
   ****************************************/
  _.each(self.def.one, function(relation){
    // Ensure singularization.
    relation = Inflect.singular(relation);

    // We need a different db connection for the relations.
    var relation_db = new Store(self.def.db.type, {
      database: self.def.db.name
      , collection: Inflect.plural(relation)
    });

    /*********
     * Read
     *********/
    ctx.route('get', '/'+self.name+'/:id/'+relation+'/:relation_id', function(req, res) {
      self.def.read(req, res);
      self.db.read(req.params.id, function(err, doc) {
        relation_db.read(doc[relation+'_id'], function(err, doc) {
          req.geck.emit(err ? 'error' : 'success', err ? err : doc);
        });
      });
    });
  });
  

  /****************************************
   * 
   * Define many-to-many relational routes.
   * 
   ****************************************/
  _.each(self.def.many_to_many, function(pivot, relation){
    // Ensure singularization.
    relation = Inflect.singular(relation);
    pivot = Inflect.singular(pivot);

    // We need a different db connection for the relations.
    var relation_db = new Store(self.def.db.type, {
      database: self.def.db.name
      , collection: Inflect.plural(relation)
    });

    // We need a different db connection for the pivot table.
    var pivot_db = new Store(self.def.db.type, {
      database: self.def.db.name
      , collection: Inflect.plural(pivot)
    });

    /************
     * Associate
     ************/
    ctx.route('post', '/'+self.name+'/:id/'+relation+'/:relation_id?', function(req, res) {
      self.def.read(req, res);

      // Set search criteria.
      var criteria = req.body || {};
      criteria[self.name+'_id'] = req.params.id;
      if (typeof req.params.relation_id !== 'undefined') {
        criteria[relation+'_id'] = req.params.relation_id;
      }
      
      // Make sure the relation doesn't exist yet.
      pivot_db.read(criteria, function(err, doc){
        if (err) {
          pivot_db.create(criteria, function(err, doc){
            req.geck.emit(err ? 'error' : 'success', err ? err : doc);
          });
        } else {
          req.geck.emit('error', pivot+' already exists.');
        }
      });
    });

    /********
     * List
     ********/
    ctx.route('get', '/'+self.name+'/:id/'+Inflect.plural(relation), function(req, res){
      self.def.list(req, res);
      var criteria = {};
      criteria[self.name+'_id'] = req.params.id;
      pivot_db.list(criteria, function(err, docs){
        if (err) {
          req.geck.emit('error', err);
        } else {
          var ids = _.map(docs, function(val, key){
            return val[relation+'_id'];
          });
          relation_db.list({ id: { '$in': ids } }, function(err, docs){
            req.geck.emit(err ? 'error' : 'success', err ? err : docs);
          });
        }
      });
    });
  });
};

module.exports = Resource;