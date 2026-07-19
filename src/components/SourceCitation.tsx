import { FileCode2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SourceCitation({ filePaths }: { filePaths: string[] }) {
  if (!filePaths || filePaths.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {filePaths.map((path, idx) => (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: idx * 0.1 }}
          key={path}
          className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/50 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <FileCode2 className="w-3.5 h-3.5 text-primary" />
          <span className="truncate max-w-[200px]" title={path}>
            {path.split('/').pop()}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
