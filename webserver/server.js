const express = require('express')
const app = express()
const port = 8443

app.use(express.static('public'))

app.listen(port, () => {
  console.log(`Somapah Pollo Frito server running on port ${port}`)
})
