const mongoose = require('mongoose')
const config = require('../config/index.js')

console.log("URI", config.mongoDBUri)

let connection = mongoose.connect(config.mongoDBUri)

mongoose.connection.on('connected', () => {
    console.log("DB connected successfully.")
})

mongoose.connection.on('error', err => {
    console.log("DB ERROR:", err)
})

module.exports = connection