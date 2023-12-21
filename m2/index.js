// Импорт зависимостей
const express = require('express');
const amqp = require('amqplib');
const logger = require('./logger');

const app = express();

// Импорт переменных среды
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://rabbitmq:5672";
const SECOND = process.env.SECOND || "second_queue";

let channel, connection;

// Функция подключения к RabbitMQ
async function connect() {
  try {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue(SECOND);
    logger.info(" [x] Подключение к RabbitMQ успешно");
  } catch (error) {
    console.error(" [x] Ошибка подключения к RabbitMQ:", error);
  }
}
 
// Создаю подключение с задержкой в 13 сек, чтобы RabbitMQ успел подняться
// Создаю консьюмер для второго сервиса.
// При получении сообщения от первого сервиса, получаем число и обрабатываем его.
// С задерькой в 5 сек отправляем ответ в очередь первого сервиса.
setTimeout(() => {
  connect().then(() => {
    logger.info(' [x] Одижание RPC запроса');
    channel.consume(SECOND, data => {
        logger.info(" [x] Получено сообщение от первого сервиса");
        const { number } = JSON.parse(data.content);
        const { correlationId } = data.properties;
        const result = number * 2;
  
        logger.info(` [x] Получено число ${number} c id: ${correlationId}`);
          
  
        setTimeout(() => {
          logger.info(` [x] Отправка ответа: ${result} в ${data.properties.replyTo} очередь`);
          channel.sendToQueue(data.properties.replyTo, Buffer.from(JSON.stringify({ result })), {correlationId});
        }, 5000); // Имитация задержки обработки
  
      channel.ack(data);
    })
  }).catch(console.error);
}, 13000);

app.listen(4000, () => {
  logger.info("Второй сервис запущен на порту 4000");
});
