import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ProblemAnswer {
  label: string;
  coordinate: string;
}

interface ProblemData {
  id: string;
  problemNumber: number;
  moves: number;
  sgf: string;
  answers: ProblemAnswer[];
}

interface YosemonProblemContextType {
  problemData: { [key: string]: ProblemData };
  setProblemData: (problemId: string, data: ProblemData) => void;
  getProblemData: (problemId: string) => ProblemData | undefined;
  clearProblemData: (problemId: string) => void;
}

const YosemonProblemContext = createContext<YosemonProblemContextType | undefined>(undefined);

export const YosemonProblemProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [problemData, setProblemDataState] = useState<{ [key: string]: ProblemData }>({});

  const setProblemData = (problemId: string, data: ProblemData) => {
    setProblemDataState(prev => ({
      ...prev,
      [problemId]: data
    }));
  };

  const getProblemData = (problemId: string) => {
    return problemData[problemId];
  };

  const clearProblemData = (problemId: string) => {
    setProblemDataState(prev => {
      const newData = { ...prev };
      delete newData[problemId];
      return newData;
    });
  };

  return (
    <YosemonProblemContext.Provider value={{ problemData, setProblemData, getProblemData, clearProblemData }}>
      {children}
    </YosemonProblemContext.Provider>
  );
};

export const useYosemonProblem = () => {
  const context = useContext(YosemonProblemContext);
  if (!context) {
    throw new Error('useYosemonProblem must be used within a YosemonProblemProvider');
  }
  return context;
};