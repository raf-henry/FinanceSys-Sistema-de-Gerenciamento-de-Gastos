package com.projetopessoal.projeto.config;

import org.springframework.web.util.HtmlUtils;

public class InputSanitizer {
    public static String sanitize(String input) {
        if (input == null) return null;
        // Remove tags HTML para evitar XSS básico, mas preserva acentos
        return input.replaceAll("<[^>]*>", "").trim();
    }
}
