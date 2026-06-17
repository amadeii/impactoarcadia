import { governanceService } from "./service";

interface PolicyTestCase {
  name: string;
  agent: string;
  action: string;
  target: string;
  context?: any;
  expectedAllowed: boolean;
  description: string;
}

const POLICY_TEST_CASES: PolicyTestCase[] = [
  {
    name: "block_write_protected_file",
    agent: "generator",
    action: "write_file",
    target: "server/routes.ts",
    expectedAllowed: false,
    description: "Escrita em arquivo protegido deve ser bloqueada",
  },
  {
    name: "block_write_schema",
    agent: "generator",
    action: "write_file",
    target: "shared/schema.ts",
    expectedAllowed: false,
    description: "Escrita no schema deve ser bloqueada",
  },
  {
    name: "block_write_index",
    agent: "executor",
    action: "write_file",
    target: "server/index.ts",
    expectedAllowed: false,
    description: "Escrita no index deve ser bloqueada",
  },
  {
    name: "allow_read_any_file",
    agent: "researcher",
    action: "read_file",
    target: "server/routes.ts",
    expectedAllowed: true,
    description: "Leitura de qualquer arquivo deve ser permitida",
  },
  {
    name: "allow_read_schema",
    agent: "architect",
    action: "read_file",
    target: "shared/schema.ts",
    expectedAllowed: true,
    description: "Leitura do schema deve ser permitida",
  },
  {
    name: "block_destructive_rm",
    agent: "executor",
    action: "run_command",
    target: "rm -rf /",
    context: { command: "rm -rf /" },
    expectedAllowed: false,
    description: "Comando rm -rf deve ser bloqueado",
  },
  {
    name: "block_destructive_drop",
    agent: "generator",
    action: "run_command",
    target: "DROP TABLE users",
    context: { command: "DROP TABLE users" },
    expectedAllowed: false,
    description: "Comando DROP TABLE deve ser bloqueado",
  },
  {
    name: "block_destructive_delete",
    agent: "executor",
    action: "run_command",
    target: "DELETE FROM blackboard_tasks",
    context: { command: "DELETE FROM blackboard_tasks" },
    expectedAllowed: false,
    description: "Comando DELETE FROM deve ser bloqueado",
  },
  {
    name: "allow_write_new_file",
    agent: "generator",
    action: "write_file",
    target: "client/src/pages/NewModule.tsx",
    expectedAllowed: true,
    description: "Escrita em novo arquivo deve ser permitida",
  },
  {
    name: "allow_typecheck",
    agent: "validator",
    action: "typecheck",
    target: "typecheck",
    expectedAllowed: true,
    description: "TypeCheck deve ser permitido para validador",
  },
  {
    name: "block_write_package_json",
    agent: "generator",
    action: "write_file",
    target: "package.json",
    expectedAllowed: false,
    description: "Escrita no package.json deve ser bloqueada",
  },
  {
    name: "allow_list_directory",
    agent: "architect",
    action: "list_directory",
    target: "server/",
    expectedAllowed: true,
    description: "Listagem de diretório deve ser permitida",
  },
];

export interface PolicyTestResult {
  name: string;
  description: string;
  passed: boolean;
  expected: boolean;
  actual: boolean;
  reason: string;
}

export interface PolicyTestSuiteResult {
  total: number;
  passed: number;
  failed: number;
  results: PolicyTestResult[];
  summary: string;
  ranAt: string;
}

export async function runPolicyTests(): Promise<PolicyTestSuiteResult> {
  const results: PolicyTestResult[] = [];

  for (const tc of POLICY_TEST_CASES) {
    try {
      const evaluation = await governanceService.evaluatePolicy(
        tc.agent,
        tc.action,
        tc.target,
        tc.context
      );

      const passed = evaluation.allowed === tc.expectedAllowed;
      results.push({
        name: tc.name,
        description: tc.description,
        passed,
        expected: tc.expectedAllowed,
        actual: evaluation.allowed,
        reason: evaluation.reason,
      });
    } catch (error: any) {
      results.push({
        name: tc.name,
        description: tc.description,
        passed: false,
        expected: tc.expectedAllowed,
        actual: false,
        reason: `Erro ao executar teste: ${error.message}`,
      });
    }
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    total: results.length,
    passed,
    failed,
    results,
    summary: failed === 0 
      ? `Todos os ${passed} testes passaram. Fail-closed está funcionando corretamente.`
      : `${failed} de ${results.length} testes falharam. Verifique as políticas de segurança.`,
    ranAt: new Date().toISOString(),
  };
}

export { POLICY_TEST_CASES };
