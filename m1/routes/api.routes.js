const express = require('express');
const router = express.Router();

module.exports = (channel) => {

  router.post("/api/v1/queue", async (req, res) => {
    const { number } = req.body;
  
    if (typeof number !== "number") {
        return res.status(400).send({ error: "Неверный формат данных, ожидается число." });
    }
  
    try {
        await channel.sendToQueue(process.env.QUEUE_NAME, Buffer.from(JSON.stringify({ number })));
        res.send({ message: "Запрос отправлен в обработку." });
    } catch (error) {
        console.error("Ошибка отправки в RabbitMQ:", error);
        res.status(500).send({ error: "Ошибка при обработке запроса." });
    }
  });
  
  router.get('/', (req, res) => {
    res.send("Hello World!");
  })
  
  return router;
};