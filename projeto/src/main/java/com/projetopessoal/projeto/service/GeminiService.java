package com.projetopessoal.projeto.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@Service
public class GeminiService {

    @Value("${GEMINI_API_KEY:NOT_FOUND}")
    private String apiKey;

    private final String GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=";

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public List<Map<String, Object>> processarExtratoCaixa(byte[] pdfBytes) throws Exception {
        return processarExtrato(pdfBytes, "Caixa Econômica Federal", 
            "O extrato da Caixa possui colunas: Lançamentos (data), Nr. Doc, Histórico/Complemento, Valor, Saldo. " +
            "Para CADA lançamento, extraia TODOS os campos abaixo: " +
            "1. 'dataGasto': A data do lançamento no formato ISO-8601 (ex: '2026-05-17T00:00:00'). Se só houver dia/mês, use o ano do extrato. " +
            "2. 'nrDoc': O número do documento da coluna 'Nr. Doc'. Se não houver, retorne null. " +
            "3. 'descricao': O texto principal do Histórico/Complemento. Se contiver um hífen '-' seguido de um nome, pegue APENAS o que vem ANTES do hífen. " +
            "4. 'favorecido': O nome da pessoa ou estabelecimento. Se o Histórico contiver um hífen '-', pegue o que vem DEPOIS dele. Se não houver, retorne null. " +
            "5. 'cpfCnpj': Se houver um CPF ou CNPJ no complemento, extraia-o. Caso contrário, retorne null. " +
            "6. 'valor': O valor ABSOLUTO da transação (sempre positivo, sem sinal). Ex: se o extrato mostra '-61,40', retorne 61.40. " +
            "7. 'saldo': O saldo da conta APÓS esta transação, como número. Ex: '1.234,56' vira 1234.56. " +
            "8. 'tipo': 'RECEITA' se o valor for positivo/crédito ou indicar entrada (depósito, transferência recebida). 'DESPESA' se negativo/débito ou indicar saída. " +
            "9. 'formaPagamento': Identifique se foi Pix, Cartão, DOC, TED, Boleto ou Dinheiro com base no Histórico. " +
            "10. 'categoria': Baseado no Histórico, classifique como Alimentação, Transporte, Lazer, Moradia, Saúde, Educação, Assinaturas ou Outros. Nunca coloque 'Pix' aqui.");
    }

    public List<Map<String, Object>> processarExtratoNubank(byte[] pdfBytes) throws Exception {
        return processarExtrato(pdfBytes, "Nubank", 
            "Analise as seções de 'Movimentações'. " +
            "Identifique: " +
            "1. 'tituloExibicao': Se o título contiver a palavra 'pelo', pegue apenas o que vem ANTES dela. Se não, pegue o título todo. " +
            "2. 'nomeContraparte': Se o título contiver a palavra 'pelo', pegue apenas o que vem DEPOIS dela. Se não, deixe vazio. " +
            "3. 'valor': O valor numérico absoluto. " +
            "4. 'tipoMovimentacao': 'ENTRADA' se o título indicar recebimento (ex: 'recebida pelo Pix', 'reembolso', 'depósito') ou valor positivo. " +
            "   'SAIDA' se o título indicar envio/pagamento (ex: 'enviada pelo Pix', 'pagamento de fatura', 'compra no débito') ou valor negativo. " +
            "   'RENDIMENTO' para rendimentos. " +
            "5. 'formaPagamento': Se o título contiver 'Pix', 'Crédito' ou 'Débito', coloque aqui. Não coloque na categoria. " +
            "6. 'categoria': Classifique o gasto (ex: Alimentação, Transporte, Lazer). Nunca use 'Pix' como categoria.");
    }

    public List<Map<String, Object>> processarExtratoPicPay(byte[] pdfBytes) throws Exception {
        return processarExtrato(pdfBytes, "PicPay", 
            "Identifique as transações no extrato PicPay. " +
            "1. 'tipo': 'RECEITA' para depósitos, cashbacks e recebimentos. 'DESPESA' para pagamentos e envios. " +
            "2. 'valor': O valor da transação. " +
            "3. 'descricao': O tipo da operação. Se houver um hífen '-', pegue o que vem ANTES dele (ex: 'Pix recebido'). Se não houver hífen e for um nome de loja, use 'Pagamento' ou 'Compra'. " +
            "4. 'favorecido': O nome da pessoa ou estabelecimento. Se houver um hífen '-', pegue o que vem DEPOIS dele. Se não houver hífen, pegue o nome completo do local. " +
            "5. 'formaPagamento': Identifique se foi 'Saldo PicPay', 'Cartão de Crédito', 'Pix'. " +
            "6. 'categoria': Classifique o gasto (ex: Alimentação, Assinaturas). Nunca use 'Pix' como categoria.");
    }

    private List<Map<String, Object>> processarExtrato(byte[] pdfBytes, String banco, String regrasEspecificas) throws Exception {
        if ("NOT_FOUND".equals(apiKey) || apiKey.startsWith("${")) {
            throw new RuntimeException("Configuração de API ausente.");
        }
        
        String base64Pdf = Base64.getEncoder().encodeToString(pdfBytes);

        String prompt = "Você é um especialista em extração de dados bancários brasileiros. " +
                "Analise este extrato do " + banco + " e extraia TODOS os lançamentos financeiros. " +
                regrasEspecificas +
                "\nConsidere as seguintes regras CRÍTICAS: " +
                "1. Diferencie ENTRADA de SAÍDA com extrema atenção. Valores que diminuem o saldo ou são pagamentos são SAÍDA/DESPESA. " +
                "2. 'formaPagamento' deve conter COMO foi pago (Pix, Cartão, Dinheiro). " +
                "3. 'categoria' deve conter O QUE foi pago (Alimentação, Lazer, etc). NUNCA coloque 'Pix' na categoria. " +
                "4. Responda APENAS com um array JSON válido, sem markdown.";

        Map<String, Object> requestBody = Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(
                                Map.of("text", prompt),
                                Map.of("inline_data", Map.of(
                                        "mime_type", "application/pdf",
                                        "data", base64Pdf
                                ))
                        ))
                )
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
        
        java.net.URI uri = java.net.URI.create(GEMINI_API_URL + apiKey);
        ResponseEntity<byte[]> response = restTemplate.postForEntity(uri, entity, byte[].class);
        
        if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
            String responseBody = new String(response.getBody(), java.nio.charset.StandardCharsets.UTF_8);
            JsonNode root = objectMapper.readTree(responseBody);
            String jsonOutput = root.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText();
            
            jsonOutput = jsonOutput.replace("```json", "").replace("```", "").trim();
            
            return objectMapper.readValue(jsonOutput, List.class);
        } else {
            throw new RuntimeException("Erro ao chamar API do Gemini: " + response.getStatusCode());
        }
    }
}
