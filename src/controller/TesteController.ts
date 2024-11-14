import { Request, Response } from 'express';
import DB from "../database/db";
import {cpf, cnpj} from "cpf-cnpj-validator";
import Joi from "joi";

const clearCpf = (cpf: string): string => {
    return cpf.replace(/[^\d]/g, '');
}

const validateCpf = (cpf: string): boolean => {
    // Limpa o CPF, removendo pontos e hífen
    const cpfClean = clearCpf(cpf);

    // Verifica se o CPF tem 11 dígitos
    if (cpfClean.length !== 11) {
        return false;
    }

    // Verifica se todos os números são iguais (ex: 111.111.111-11, 222.222.222-22, etc.)
    if (/^(\d)\1{10}$/.test(cpfClean)) {
        return false;
    }

    let dig1 = 0;
    let wheigt1 = 10;
    for (let i = 0; i < 9; i++) {
        dig1 += parseInt(cpfClean[i]) * wheigt1--;
    }
    let dv1 = (dig1 * 10) % 11;
    if (dv1 === 10) dv1 = 0;


    let dig2 = 0;
    let wheigt2 = 11;
    for (let i = 0; i < 9; i++) {
        dig2 += parseInt(cpfClean[i]) * wheigt2--;
    }
    dig2 += dv1 * 2;
    let dv2 = (dig2 * 10) % 11;
    if (dv2 === 10) dv2 = 0;

    return cpfClean[9] === dv1.toString() && cpfClean[10] === dv2.toString();
}

const cnpjValidate = (value: string) => {
    return cnpj.isValid(value);
};

interface ViaCepResponse {
    cep: string;
    logradouro: string;
    bairro: string;
    localidade: string;
    uf: string;
    erro?: boolean;
}

interface AddPJRequest {
    cnpj: string;
    cpf: string;
    name: string;
    cell_phone: string;
    telephone: string;
    email: string;
    confirm_email: string;
    cep: string;
    public_place: string;
    neighborhood: string;
    number: string;
    complement: string;
    city: string;
    state: string;
}

const AddPJ = async (req: Request<{}, {}, AddPJRequest>, res: Response) => {
    const {cnpj, cpf, name, cell_phone, telephone, email, confirm_email, cep, public_place, neighborhood, number, complement, city, state} = req.body;

    if (!cnpj || !cpf || !name || !cell_phone || !telephone || !email || !confirm_email || !cep || !public_place || !neighborhood || !city || !state) {
        return res.status(400).json({ error: "Todos os campos obrigatórios devem ser preenchidos." });
    }

    // Verificar e limpar CNPJ
    const cnpjClean = cnpj.replace(/[^\d]/g, "");

    // Validar CPF
    const cpfValid = validateCpf(cpf);

    if (!cpfValid) {
        return res.status(400).json({ error: "CPF inválido" });
    }

    // Validar CNPJ
    const cnpjValid = cnpjValidate(cnpjClean);

    if (!cnpjValid) {
        return res.status(400).json({ error: "CNPJ inválido" });
    }


    // Validar telefone e celular
    const telValidate = /^\d{10}$/;
    const cellValidate = /^\d{11}$/; 

    
    const cellClean = cell_phone.replace(/\D/g, "");
    const telClean = telephone.replace(/\D/g, "");

    if (!cellValidate.test(cellClean)) return res.status(400).json({ error: "Formato de celular inválido" });
    if (!telValidate.test(telClean)) return res.status(400).json({ error: "Formato do telefone fixo inválido" });


    // Validar e comparar email
    const validateEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!email) return res.status(400).json({ error: "Campo email obrigatório!" });
    if (!confirm_email) return res.status(400).json({ error: "Campo de confirmação de email obrigatório!" });
    if (!validateEmail.test(email)) return res.status(400).json({ error: "Formato de email inválido!" });
    if (confirm_email !== email) return res.status(400).json({ error: "Confirmação de email deve ser igual ao campo email!" });

    
    try {
        const cepClean = cep.replace("-", "");

        const validation = await validateAddress(cepClean, city, public_place, neighborhood, state);

        const sql = `INSERT INTO comprador_vendedor (
        name,
        email,
        cell_phone,
        telephone,
        cpf,
        cnpj,
        cep,
        state,
        city,
        public_place,
        neighborhood,
        number,
        complement) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const values = [
            name,
            email,
            cellClean,
            telClean,
            clearCpf(cpf),
            cnpjClean,
            cepClean,
            state,
            city,
            public_place || "",
            neighborhood || "", 
            number,
            complement
        ];

        const [result] = await DB.query(sql, values);

        res.status(200).json({ message: "Dados Cadastrados com sucesso!" });

    } catch(error: any) {
        return res.status(error.statusCode || 500).json({error: error.message});
    }

}

const validateAddress = async (cep: string, state: string, city: string, public_place: string, neighborhood: string) => {
        if(!cep || !state || !city || !public_place || !neighborhood) return {error: "Campos de endereço obrigatorios!"};


    if(!validarCep(cep)) return {error: "Cep inválido"};

    try {

        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);

        const data = await response.json();

        if (!isViaCepResponse(data)) {
            return { error: "A resposta do ViaCEP é inválida!" };
        }

        if(data.erro) return {error: "CEP não encontrado!"};

        if(data.uf !== state) return {error: "Estado não corresponde ao CEP informado!"};
        
        if(data.localidade !== city) return {error: "Cidade não corresponde ao CEP informado!"};

        if(data.logradouro !== public_place) return {error: `O logradouro informado não corresponde ao CEP informado ou não consta ainda na base de dados.`};

        if(data.bairro && data.bairro !== neighborhood) return {error: `O bairro informado não corresponde ao CEP. ou não consta ainda na base de dados.`};


    } catch(error) {
        return {error: "Erro ao consultar CEP!"};
    }
}

function isViaCepResponse(data: any): data is ViaCepResponse {
    return typeof data.cep === 'string' &&
        typeof data.logradouro === 'string' &&
        typeof data.bairro === 'string' &&
        typeof data.localidade === 'string' &&
        typeof data.uf === 'string';
}

const validarCep = (cep: string): boolean => {
    return /^\d{5}-\d{3}$/.test(cep); 
  }

export default AddPJ;