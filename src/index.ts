import express from "express";
import AddPJ from "./controller/TesteController";
const cors = require("cors");

const app = express();

const port = process.env.PORT || 4568;

app.use(express.json());
app.use(cors());

app.get("/ping", (req, res) => {
  return res.send("pong");
});

app.post("/teste", (req, res) => {
  console.log("Corpo da requisição:", req.body);
  res.json({ message: "Teste recebido!" });
})

app.post("/cadastrar", AddPJ);

app.listen(port, () => {
  console.log(`Escutando na porta ${port}`);
});
