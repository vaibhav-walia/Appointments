var mongoose = require('mongoose');
var schema = mongoose.Schema;

//schema for users
var teacherSchema = new schema({
    name: String,
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    oauth2Client: {},
    created_at: Date,
    updated_at: Date
});
//[TODO]custom method to hash password
//[TODO]custom method to check uniqueness of username

//make a model out of the schema
var Teacher = mongoose.model('Teacher', teacherSchema);
module.exports = Teacher;
