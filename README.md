# Frankenstein em 30 noites

Plano de leitura interativo de *Frankenstein, ou o Prometeu moderno*, de Mary Shelley.

O livro começa na **Carta I** (sem introdução). São 27 noites de leitura, 3 folgas, perguntas de atenção e uma reflexão curta por seção. O progresso fica salvo no navegador.

## No ar

O site é estático e publica no GitHub Pages a cada push em `main`, pelo workflow em `.github/workflows/pages.yml`.

Está no ar em:

https://hugopoletto34.github.io/frankenstein-30-noites/

Repositório: https://github.com/HugoPoletto34/frankenstein-30-noites

## Localmente

Abra `index.html` num servidor local (não como arquivo `file://`, por causa de módulos e caminhos):

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Depois acesse `http://127.0.0.1:8000`.
