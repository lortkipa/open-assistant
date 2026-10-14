import { MockAuthClient } from "@open-assistant/shared";
import { useState } from "react";
import { CodeStep } from "./CodeStep";
import { DoneStep } from "./DoneStep";
import { EmailStep } from "./EmailStep";
import { Mark } from "./Mark";
import { NameStep } from "./NameStep";

// No backend yet: every sign-in goes through the mock (test code 123456).
const auth = new MockAuthClient();

type Step = "start" | "code" | "name" | "done";

export function LoginScreen() {
  const [step, setStep] = useState<Step>("start");
  const [email, setEmail] = useState("");
  const [signedInAs, setSignedInAs] = useState("");
  const [name, setName] = useState("");

  function askName(how: string) {
    setSignedInAs(how);
    setStep("name");
  }

  return (
    <div className="page">
      <header>
        <Mark />
      </header>

      <main>
        {step === "start" && (
          <EmailStep
            email={email}
            onEmailChange={setEmail}
            onSubmit={() => setStep("code")}
            onGoogle={async () => {
              await auth.signInWithGoogle();
              askName("with Google");
            }}
          />
        )}
        {step === "code" && (
          <CodeStep
            auth={auth}
            email={email}
            onVerified={() => askName(`as ${email}`)}
            onBack={() => setStep("start")}
          />
        )}
        {step === "name" && (
          <NameStep
            onSubmit={(n) => {
              setName(n);
              setStep("done");
            }}
            onBack={() => setStep("start")}
          />
        )}
        {step === "done" && (
          <DoneStep
            name={name}
            signedInAs={signedInAs}
            onRestart={() => {
              setEmail("");
              setStep("start");
            }}
          />
        )}
      </main>

      <footer>
        <a href="#">Terms</a>
        <a href="#">Privacy Policy</a>
      </footer>
    </div>
  );
}
