var Sequelize = require('sequelize');
var sequelize = exports.sequelize = new Sequelize('mysql://root:fl45ht4g@104.196.180.89:3306/flashtag');

// User
exports.user = sequelize.define('user', {
  username: {
    type: Sequelize.STRING,
    field: 'username',
    get: function()  {
      return this.getDataValue('username');
    }    
  }
}, {
  freezeTableName: true // Model tableName will be the same as the model name
});

// Photo
exports.photo = sequelize.define('photo', {
  path: {
    type: Sequelize.STRING,
    field: 'path' // Will result in an attribute that is firstName when user facing but first_name in the database
  },
  md5Hash: {
    type: Sequelize.STRING,
    field: 'md5Hash' // Will result in an attribute that is firstName when user facing but first_name in the database
  },
  size: {
    type: Sequelize.DOUBLE,
    field: 'size' // Will result in an attribute that is firstName when user facing but first_name in the database
  }

}, {
  freezeTableName: true // Model tableName will be the same as the model name
});
exports.photo.belongsTo(exports.user);

// Tag
exports.tag = sequelize.define('tag', {
  tag: {
    type: Sequelize.STRING,
    field: 'tag', // Will result in an attribute that is firstName when user facing but first_name in the database
    primaryKey: true
  }
}, {
  freezeTableName: true // Model tableName will be the same as the model name
});

// PhotoTag - Relationship between Photos and Tags

exports.phototag = sequelize.define('phototag', {

}, {
  freezeTableName: true, // Model tableName will be the same as the model name
  indexes: [
    {
      name: 'photoTagUnique',
      unique: true,
      method: 'BTREE',
      fields: ['tagTag', 'photoId']
    }
  ]
  
  
});
exports.phototag.belongsTo(exports.photo);
exports.phototag.belongsTo(exports.tag, {as: 'tag'});

exports.sync = function(options) {
  return sequelize.sync(options);
};