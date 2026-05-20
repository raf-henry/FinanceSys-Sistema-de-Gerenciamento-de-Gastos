package com.projetopessoal.projeto.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import java.util.List;

@Entity
@Table(name = "contas")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Conta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nome; // Ex: "Caixa Pessoal", "Nubank Empresa"

    @Column(nullable = false)
    private String banco; // Ex: "CAIXA", "NUBANK", "ITAÚ"

    private String tipo = "Conta Corrente";
    private String cor = "bg-blue-600"; // Cor para o card no front
    private String icone = "account_balance";

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User usuario;

    @JsonIgnore
    @OneToMany(mappedBy = "conta", cascade = CascadeType.ALL)
    private List<Gasto> gastos;

    @JsonIgnore
    @OneToMany(mappedBy = "conta", cascade = CascadeType.ALL)
    private List<Transacao> transacoes;
}
