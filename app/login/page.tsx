import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="login">
      <section className="login-card">
        <h1>Varejão Popular</h1>
        <div className="muted">Nova plataforma de campanhas</div>

        {params.error ? (
          <div className="error" style={{ marginTop: 18 }}>
            {params.error === "inactive"
              ? "Seu usuário está desativado."
              : "E-mail ou senha inválidos."}
          </div>
        ) : null}

        <form action={login} className="form">
          <label className="field">
            <span>E-mail</span>
            <input className="input" name="email" type="email" required />
          </label>

          <label className="field">
            <span>Senha</span>
            <input className="input" name="password" type="password" required />
          </label>

          <button className="btn primary" type="submit">
            Entrar
          </button>
        </form>
      </section>
    </main>
  );
}
