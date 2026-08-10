import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  nomeAba: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

export class ErrorBoundaryAba extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error(`Erro na aba ${this.props.nomeAba}:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 border-2 border-dashed border-destructive/20 rounded-xl bg-destructive/5 text-center space-y-4">
          <div className="flex flex-col items-center gap-2 text-destructive">
            <AlertTriangle className="h-8 w-8" />
            <h3 className="font-semibold">Erro na aba {this.props.nomeAba}</h3>
          </div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Ocorreu um erro ao renderizar esta seção da proposta. As outras abas continuam funcionando.
          </p>
          <div className="flex gap-2 justify-center">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Tentar novamente
            </Button>
          </div>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-4 p-3 bg-black/5 rounded text-[10px] text-left overflow-auto max-h-[150px]">
              {this.state.error?.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
