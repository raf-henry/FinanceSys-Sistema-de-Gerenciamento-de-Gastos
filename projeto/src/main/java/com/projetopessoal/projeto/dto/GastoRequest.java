package com.projetopessoal.projeto.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class GastoRequest {
    @NotBlank(message = "Descrição é obrigatória")
    private String descricao;

    @NotNull(message = "Valor é obrigatório")
    @Positive(message = "O valor deve ser positivo")
    private Double valor;

    private String status;
    private String tipo;
    private Integer numeroParcelas;
    private Double valorParcela;
    private Long contaId;

    private String favorecido;
    private String nrDoc;
    private String cpfCnpj;
    private Double saldo;
    private String categoria;
    private String formaPagamento;
}
