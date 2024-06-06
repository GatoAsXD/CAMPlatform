const { Schema, model } = require('mongoose')

const userData = new Schema({
    userId: {
        type: String,
        unique: true
    },
    name: {
        type: String
    },
    classes: {
        type: Array
    }
})

module.exports = model("userData", userData)