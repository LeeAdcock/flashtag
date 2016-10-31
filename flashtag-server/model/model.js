var Sequelize = require('sequelize');
var sequelize = exports.sequelize = new Sequelize('mysql://root:fl45ht4g@104.196.180.89:3306/flashtag');

exports.query = function(sql, replacements) {
  console.log(sql, replacements);
    return sequelize.query(sql,
      { 
        replacements: replacements, 
        type: sequelize.QueryTypes.SELECT 
      }
    );
}

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
  name: {
    type: Sequelize.STRING,
    field: 'name'
  },
  md5Hash: {
    type: Sequelize.STRING,
    field: 'md5Hash'
  },
  size: {
    type: Sequelize.DOUBLE,
    field: 'size'
  },
  height: {
    type: Sequelize.DOUBLE,
    field: 'height'
  },
  width: {
    type: Sequelize.DOUBLE,
    field: 'width'
  },
  rotation: {
    type: Sequelize.DOUBLE,
    field: 'rotation'
  },
  createDate: {
    type: Sequelize.DATE,
    field: 'createDate'
  },
  hidden: {
    type: Sequelize.BOOLEAN,
    field: 'hidden'
  }
}, {
  freezeTableName: true, // Model tableName will be the same as the model name
  indexes: [
    {
      name: 'md5HashUnique',
      unique: true,
      method: 'BTREE',
      fields: ['md5Hash']
    },
    {
      name: 'nameUnique',
      unique: true,
      method: 'BTREE',
      fields: ['name', 'userId']
    }
  ]
});
exports.photo.belongsTo(exports.user);

// Tag
exports.tag = sequelize.define('tag', {
  tag: {
    type: Sequelize.STRING,
    field: 'tag',
    primaryKey: true
  }
}, {
  freezeTableName: true // Model tableName will be the same as the model name
});

// PhotoTag - Relationship between Photos and Tags

exports.phototag = sequelize.define('phototag', {
  height: {
    type: Sequelize.DOUBLE,
    field: 'height'
  },
  width: {
    type: Sequelize.DOUBLE,
    field: 'width'
  },
  left: {
    type: Sequelize.DOUBLE,
    field: 'left'
  },
  top: {
    type: Sequelize.DOUBLE,
    field: 'top'
  },
  hidden: {
    type: Sequelize.BOOLEAN,
    field: 'hidden'
  }
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
exports.phototag.belongsTo(exports.tag);

exports.sync = function(options) {
  return sequelize.sync(options);
};

exports.transaction = function(callback) {
  return sequelize.transaction({
    isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED
  }, callback);
};
