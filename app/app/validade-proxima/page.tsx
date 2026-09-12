const productFields = [
  ["Nome do produto", "Ex.: Iogurte Natural"],
  ["Tipo", "Ex.: Iogurte"],
  ["Especificação", "Ex.: 170 g · Morango"],
  ["Preço normal", "Ex.: 5,99"],
  ["Preço da oferta", "Ex.: 3,99"],
  ["Data de validade", "dd/mm/aaaa"],
  ["Código de barras", "EAN/GTIN"],
] as const;

export default function ValidadeProximaPage() {
  return (
    <div>
      <header className="page-head">
        <div>
          <h1>Validade Próxima</h1>
          <p className="muted" style={{ margin: 0 }}>
            Monte encartes físicos com até 4 produtos próximos da data de vencimento.
          </p>
        </div>
        <span className="pill">Template físico · 4 produtos</span>
      </header>

      <div className="notice-card" style={{ marginBottom: 18 }}>
        <strong>Estrutura pronta para receber o template oficial</strong>
        <span>
          Assim que o modelo visual for enviado, esta tela passará a gerar a folha final para impressão sem mudar os campos abaixo.
        </span>
      </div>

      <div className="validity-grid">
        {[1, 2, 3, 4].map((index) => (
          <section className="card validity-product" key={index}>
            <div className="section-title-row">
              <div>
                <small className="eyebrow">PRODUTO {index}</small>
                <h2>Dados do encarte</h2>
              </div>
              <span className="pill">{index}/4</span>
            </div>

            <div className="form validity-form">
              {productFields.map(([label, placeholder]) => (
                <label className="field" key={label}>
                  <span>{label}</span>
                  <input className="input" placeholder={placeholder} />
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="card footer-actions">
        <div>
          <strong>Próxima etapa</strong>
          <p className="muted" style={{ margin: "5px 0 0" }}>
            Aplicar estes dados ao template oficial e gerar PDF/arquivo pronto para impressão.
          </p>
        </div>
        <button className="btn" disabled title="Disponível após a inclusão do template oficial">
          Gerar encarte físico
        </button>
      </div>
    </div>
  );
}
